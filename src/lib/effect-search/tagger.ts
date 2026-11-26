import { fixTagEffects } from './tagFixes';
import { addUsage, ChatError, ZERO_USAGE, type ChatClient, type ChatMessage, type ChatUsage, type ReasoningEffort } from './ai';
import { buildUserPrompt, type TaggerCard } from './prompt';
import { repairSnippets } from './snippets';
import { normalizeTagOutput, repairTagOutput, tagOutputSchema, validateTagOutput, type TagOutput, type Vocab } from './tagSchema';

export type TaggerConfig = {
  client: ChatClient;
  /** Workers AI model id, e.g. `@cf/zai-org/glm-5.3`. */
  model: string;
  systemPrompt: string;
  jsonSchema: Record<string, unknown>;
  vocab: Vocab;
  reasoningEffort?: ReasoningEffort;
  /** Total attempts per card, including corrections after invalid output. */
  maxAttempts?: number;
  /** Output cap per request, so a looping generation fails fast instead of streaming until the timeout. */
  maxTokens?: number;
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
  const repaired = repairTagOutput(parsed.data);
  const problems = validateTagOutput(repaired, vocab);
  return problems.length ? { errors: problems } : { output: normalizeTagOutput(repaired) };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Sentences of the card text that hold an activated effect ("...: You can ...", "...; destroy it")
 * but appear in no snippet. The model sometimes stops after the first effect or two; this catches it.
 * Once-per-turn clauses and summoning conditions aren't effects, so they're never reported.
 */
export const missingEffectText = (text: string, snippets: readonly string[]): string[] => {
  const covered = fold(snippets.join(' \n '));
  // Quoted names keep their punctuation ("Number C39: Utopia Ray"); mask it so it doesn't split or count.
  const masked = text.replace(/"[^"\n]*"/g, (q) => q.replace(/[.:;]/g, ' '));
  const missing: string[] = [];
  let start = 0;
  for (const end of [...[...masked.matchAll(/\n|\.(?=\s|$)|●/g)].map((m) => m.index! + 1), text.length]) {
    const lead = /^[\s●]*/.exec(text.slice(start, end))![0].length;
    const sentence = text.slice(start + lead, end).trim();
    const activated = /[:;]/.test(masked.slice(start + lead, end));
    start = end;
    if (!activated || sentence.length < 20 || /^(you can only|you cannot|cannot be|must be|must first|if you do)/i.test(sentence)) continue;
    // A sentence split differently than the snippet still counts when its start is there.
    const f = fold(sentence);
    if (!covered.includes(f) && !covered.includes(f.slice(0, 40))) missing.push(sentence);
  }
  return missing;
};

/** "...: You can add", "...; destroy it": something an effect does after its condition or cost. */
const ACTIVATED_CLAUSE = /[:;]\s*(you can |target |special summon |add |destroy |send |banish |draw |negate )/i;

/**
 * Effects with no actions whose snippet is several sentences including an activated effect: the
 * model copied a run of the text box (often all of it) into one effect instead of splitting it.
 */
export const collapsedEffects = (effects: readonly { snippet: string; actions: readonly unknown[] }[]): number[] =>
  effects.flatMap((e, i) => {
    if (e.actions.length || !ACTIVATED_CLAUSE.test(e.snippet)) return [];
    const sentences = e.snippet
      .replace(/"[^"]*"/g, 'X')
      .split(/\.(?:\s|$)/)
      .filter((x) => x.trim()).length;
    return sentences >= 3 ? [i] : [];
  });

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
          // A retry at temperature 0 repeats the same degenerate output (e.g. endless whitespace); vary it.
          temperature: attempt === 1 ? 0 : 0.4,
          maxTokens: cfg.maxTokens ?? 6000,
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
    if ('output' in checked) {
      // Stopped early? Ask once for the rest. A second short answer is kept (as before this check), so a
      // sentence that isn't really an effect can't make a card fail on every run.
      const missing = missingEffectText(
        [card.effectText, card.pendulumText].filter(Boolean).join('\n'),
        checked.output.effects.map((e) => e.snippet),
      );
      const collapsed = collapsedEffects(checked.output.effects);
      if ((missing.length || collapsed.length) && attempt < maxAttempts) {
        const problems = [
          ...missing.map(
            (m) =>
              `This part of the card text is in none of your effects: "${m}". Add it as its own effect with its actions (or, if it belongs to an effect you listed, include it in that effect's snippet).`,
          ),
          ...collapsed.map(
            (i) =>
              `effects[${i}] holds several sentences of the text, including an activated effect, but has no actions: split the text into its separate effects and record their actions.`,
          ),
        ];
        messages.push(
          { role: 'assistant', content },
          {
            role: 'user',
            content: `That output is incomplete:\n${problems.map((p) => `- ${p}`).join('\n')}\nReturn the complete corrected JSON for the same card.`,
          },
        );
        lastError = problems.join(' ');
        continue;
      }
      const effects = fixTagEffects(
        repairSnippets(checked.output.effects, { card: card.effectText, pendulum: card.pendulumText }),
        [card.effectText, card.pendulumText].filter(Boolean).join('\n'),
      );
      return { ok: true, output: { ...checked.output, effects }, attempts: attempt, usage };
    }
    lastError = checked.errors.join('; ');
    // Broken JSON is usually a degenerate generation (e.g. thousands of blank lines): retry fresh at a
    // higher temperature rather than feeding it back. Valid-but-wrong output gets a correction turn.
    if (checked.errors[0]?.startsWith('Output is not valid JSON')) continue;
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
