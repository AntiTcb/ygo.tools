import { z } from 'zod';
import type { ChatClient, ChatUsage, ReasoningEffort } from './ai';
import type { PromptVocab } from './prompt';
import { parserReplySchema, type ParserReply, type SearchQueryInput } from './query';
import { ATTRIBUTE_NAMES, CARD_TYPES, MONSTER_KINDS, RACE_NAMES, SPELL_TRAP_TYPES, type Vocab } from './tagSchema';

/** Bump when the parser prompt changes (AI Gateway caches by request, so this also busts the cache). */
export const PARSER_PROMPT_VERSION = 'q1';

const EXAMPLES: { q: string; reply: { query: SearchQueryInput } | { unsupported: string } }[] = [
  {
    q: 'cards that can special summon Toadally Awesome from the GY',
    reply: { query: { mode: 'does', verb: 'special_summon', from_zones: ['gy'], target: { card: 'Toadally Awesome' } } },
  },
  {
    q: "monsters that trigger when they're sent to the GY as a cost for a WATER monster's effect",
    reply: {
      query: {
        mode: 'responds_to',
        verb: 'send_to_gy',
        subject_is_self: true,
        cause: 'cost',
        cause_card: { card_types: ['monster'], attributes: ['WATER'] },
        card_filter: { card_types: ['monster'] },
      },
    },
  },
  {
    q: 'monsters whose cost sends a WATER monster to the graveyard',
    reply: {
      query: {
        mode: 'does',
        verb: 'send_to_gy',
        is_cost: true,
        target: { card_types: ['monster'], attributes: ['WATER'] },
        card_filter: { card_types: ['monster'] },
      },
    },
  },
  {
    q: 'spells that search a frog',
    reply: {
      query: {
        mode: 'does',
        verb: 'add_to_hand',
        from_zones: ['deck'],
        target: { card_types: ['monster'], archetypes: ['Frog'] },
        card_filter: { card_types: ['spell'] },
      },
    },
  },
  {
    q: "banish from opponent's graveyard",
    reply: { query: { mode: 'does', verb: 'banish', from_zones: ['gy'], from_side: 'opponent' } },
  },
  {
    q: 'level 4 or lower warriors that special summon themselves from the hand',
    reply: {
      query: {
        mode: 'does',
        verb: 'special_summon',
        from_zones: ['hand'],
        target: { card: '__self__' },
        card_filter: { races: ['Warrior'], level: { op: 'lte', value: 4 } },
      },
    },
  },
  { q: 'what is the best deck right now', reply: { unsupported: 'That is not a question about what card effects do.' } },
];

const termList = (terms: { term: string; description: string }[]) => terms.map((t) => `- ${t.term}: ${t.description}`).join('\n');

export const buildParserPrompt = (
  vocab: PromptVocab,
): string => `You turn a Yu-Gi-Oh! player's search request into a structured query over a database of card effects. Output only JSON.

Return {"query": {...}} or, if the request isn't about what card effects do, {"unsupported": "<short reason>"}.

## Query fields
- mode: "does" when the request is about what a card's effect does ("cards that special summon X"); "responds_to" when it is about what an effect triggers on ("cards that activate when X is destroyed").
- verb: the action ("does") or event ("responds_to"); one of the verbs below. Searching ("search", "add from deck") is add_to_hand from the deck; "mill" is send_to_gy from the deck; "revive"/"reborn" is special_summon from the GY.
- from_zones / to_zones: zones the request names. from_side: "you" / "opponent" / "either" when the request says whose zone ("your opponent's GY" -> opponent).
- is_cost: true when the request is specifically about costs ("whose cost...", "by paying/discarding as a cost"); otherwise omit.
- target ("does"): what the action applies to. A specific card name -> {"card": "<exact name as typed>"}. A description -> card fields (below). The cards themselves ("special summon themselves", "this card") -> {"card": "__self__"}. Omit when the request doesn't restrict it.
- responds_to: subject_is_self true when the event happens to the card itself ("when this card is sent to the GY"); otherwise "target" describes the card the event happens to. cause ("cost", "effect", "battle", "material") and cause_card describe what caused it.
- card_filter: constraints on the cards being searched for, not on what they affect ("WATER monsters that...", "spells that...", "level 4 or lower warriors that...").
- Card fields: card_types ${JSON.stringify(CARD_TYPES)}; attributes ${JSON.stringify(ATTRIBUTE_NAMES)}; races ${JSON.stringify(RACE_NAMES)}; monster_kinds ${JSON.stringify(MONSTER_KINDS)}; spell_trap_types ${JSON.stringify(SPELL_TRAP_TYPES)}; level / rank / link_rating / atk / def as {"op": "eq|neq|lt|lte|gt|gte", "value": n}; archetypes (e.g. ["Frog"]); names; exclude_names; exclude_monster_kinds; any_of (list of alternatives).
- Leave out anything the request doesn't say. Prefer the broadest reasonable reading.

## Verbs
${termList(vocab.verbs)}

## Zones
${termList(vocab.zones)}

## Examples
${EXAMPLES.map((e) => `Request: ${e.q}\nOutput: ${JSON.stringify(e.reply)}`).join('\n\n')}`;

/** JSON schema for the parser's structured output, with verbs and zones narrowed to the vocabulary. */
export const buildParserJsonSchema = (vocab: Vocab): Record<string, unknown> => {
  const verbs = [...new Set([...vocab.actionVerbs, ...vocab.eventVerbs])];
  const schema = z.toJSONSchema(parserReplySchema, { io: 'input', target: 'draft-2020-12' }) as Record<string, unknown>;
  delete schema.$schema;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const props = (node as { properties?: Record<string, unknown> }).properties;
    if (props && 'mode' in props && 'verb' in props) {
      props.verb = { type: 'string', enum: verbs };
      props.from_zones = { type: 'array', items: { type: 'string', enum: [...vocab.zones] } };
      props.to_zones = { type: 'array', items: { type: 'string', enum: [...vocab.zones] } };
    }
    Object.values(node).forEach(visit);
  };
  visit(schema);
  return schema;
};

export type ParseResult =
  | { ok: true; reply: ParserReply; usage: ChatUsage; ms: number }
  | { ok: false; error: string; usage: ChatUsage | null; ms: number };

/** Validates a parser reply: shape, and verbs/zones from the vocabulary in the right role. */
export const checkParserReply = (content: string, vocab: Vocab): { reply: ParserReply } | { error: string } => {
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ''));
  } catch (e) {
    return { error: `not valid JSON: ${(e as Error).message}` };
  }
  const parsed = parserReplySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  if ('query' in parsed.data) {
    const q = parsed.data.query;
    const verbs = q.mode === 'does' ? vocab.actionVerbs : vocab.eventVerbs;
    if (!verbs.includes(q.verb)) return { error: `"${q.verb}" is not ${q.mode === 'does' ? 'an action' : 'an event'} verb` };
    const bad = [...q.from_zones, ...q.to_zones].find((z) => !vocab.zones.includes(z));
    if (bad) return { error: `unknown zone "${bad}"` };
  }
  return { reply: parsed.data };
};

export type ParserConfig = {
  client: ChatClient;
  model: string;
  systemPrompt: string;
  jsonSchema: Record<string, unknown>;
  vocab: Vocab;
  reasoningEffort?: ReasoningEffort;
};

/** One model call (plus one corrective retry on invalid output). */
export const parseSearchRequest = async (request: string, cfg: ParserConfig): Promise<ParseResult> => {
  const started = Date.now();
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: cfg.systemPrompt },
    { role: 'user', content: `Request: ${request.trim().slice(0, 300)}\nOutput:` },
  ];
  let usage: ChatUsage | null = null;
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await cfg.client({
        model: cfg.model,
        messages,
        jsonSchema: { name: 'search_query', schema: cfg.jsonSchema },
        reasoningEffort: cfg.reasoningEffort,
        temperature: 0,
        maxTokens: 1200,
      });
      usage = usage
        ? {
            promptTokens: usage.promptTokens + res.usage.promptTokens,
            cachedPromptTokens: usage.cachedPromptTokens + res.usage.cachedPromptTokens,
            completionTokens: usage.completionTokens + res.usage.completionTokens,
          }
        : res.usage;
      const checked = checkParserReply(res.content, cfg.vocab);
      if ('reply' in checked) return { ok: true, reply: checked.reply, usage, ms: Date.now() - started };
      lastError = checked.error;
      messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: `Invalid: ${checked.error}. Return corrected JSON.` });
    } catch (e) {
      return { ok: false, error: (e as Error).message, usage, ms: Date.now() - started };
    }
  }
  return { ok: false, error: lastError, usage, ms: Date.now() - started };
};
