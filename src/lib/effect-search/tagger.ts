import { addUsage, ChatError, ZERO_USAGE, type ChatClient, type ChatMessage, type ChatUsage } from './ai';
import { buildUserPrompt, type TaggerCard } from './prompt';
import { normalizeTagOutput, tagOutputSchema, validateTagOutput, type TagOutput, type Vocab } from './tagSchema';

export type TaggerConfig = {
  client: ChatClient;
  /** Workers AI model id, e.g. `@cf/moonshotai/kimi-k2.6`. */
  model: string;
  systemPrompt: string;
  jsonSchema: Record<string, unknown>;
  vocab: Vocab;
  reasoningEffort?: 'none' | 'high';
  /** Total attempts per card, including corrections after invalid output. */
  maxAttempts?: number;
};

export type TagResult =
  | { ok: true; output: TagOutput; attempts: number; usage: ChatUsage }
  | { ok: false; error: string; attempts: number; usage: ChatUsage; lastContent: string | null };

/** Models sometimes wrap JSON in a code fence even with structured outputs. */
const stripFence = (s: string) => s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

/** Parses and checks one model reply; returns the problems to feed back to the model. */
export const checkTaggerReply = (content: string, vocab: Vocab): { output: TagOutput } | { errors: string[] } => {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFence(content));
  } catch (e) {
    return { errors: [`Output is not valid JSON: ${(e as Error).message}`] };
  }
  const parsed = tagOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const problems = validateTagOutput(parsed.data, vocab);
  return problems.length ? { errors: problems } : { output: normalizeTagOutput(parsed.data) };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tags one card. Invalid output is sent back to the model with the errors for a corrected attempt;
 * transient API failures (429/5xx) are retried with backoff without counting as attempts.
 */
export const tagCard = async (card: TaggerCard, cfg: TaggerConfig): Promise<TagResult> => {
  const maxAttempts = cfg.maxAttempts ?? 2;
  const messages: ChatMessage[] = [
    { role: 'system', content: cfg.systemPrompt },
    { role: 'user', content: buildUserPrompt(card) },
  ];
  let usage = ZERO_USAGE;
  let lastContent: string | null = null;
  let lastError = 'no attempts made';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let content: string;
    for (let transient = 0; ; transient++) {
      try {
        const res = await cfg.client({
          model: cfg.model,
          messages,
          jsonSchema: { name: 'card_effects', schema: cfg.jsonSchema },
          reasoningEffort: cfg.reasoningEffort,
          temperature: 0,
        });
        usage = addUsage(usage, res.usage);
        content = res.content;
        break;
      } catch (e) {
        if (!(e instanceof ChatError) || !e.retryable || transient >= 4) {
          return { ok: false, error: (e as Error).message, attempts: attempt, usage, lastContent };
        }
        await sleep(2000 * 2 ** transient);
      }
    }

    lastContent = content;
    const checked = checkTaggerReply(content, cfg.vocab);
    if ('output' in checked) return { ok: true, output: checked.output, attempts: attempt, usage };
    lastError = checked.errors.join('; ');
    messages.push(
      { role: 'assistant', content },
      {
        role: 'user',
        content: `That output has problems:\n${checked.errors.map((e) => `- ${e}`).join('\n')}\nReturn the corrected JSON for the same card.`,
      },
    );
  }
  return { ok: false, error: lastError, attempts: maxAttempts, usage, lastContent };
};
