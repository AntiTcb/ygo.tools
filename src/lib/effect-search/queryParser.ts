import { z } from 'zod';
import { addUsage, ChatError, ZERO_USAGE, type ChatClient, type ChatUsage, type ReasoningEffort } from './ai';
import type { PromptVocab } from './prompt';
import { parserReplySchema, type ParserReply, type SearchQuery, type SearchQueryInput } from './query';
import { ATTRIBUTE_NAMES, CARD_TYPES, MONSTER_KINDS, RACE_NAMES, SPELL_TRAP_TYPES, type Vocab } from './tagSchema';

/** Bump when the parser prompt changes (AI Gateway caches by request, so this also busts the cache). */
export const PARSER_PROMPT_VERSION = 'q5';

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
  {
    q: 'cards that can be summoned by Original Sinful Spoils - Snake-Eye',
    reply: { query: { mode: 'affected_by', verb: 'special_summon', source: { card: 'Original Sinful Spoils - Snake-Eye' } } },
  },
  {
    q: 'what WATER monsters can Swap Frog send to the GY',
    reply: {
      query: {
        mode: 'affected_by',
        verb: 'send_to_gy',
        source: { card: 'Swap Frog' },
        card_filter: { card_types: ['monster'], attributes: ['WATER'] },
      },
    },
  },
  {
    q: 'Level 1 FIRE monsters',
    reply: { query: { mode: 'cards', card_filter: { card_types: ['monster'], attributes: ['FIRE'], level: { op: 'eq', value: 1 } } } },
  },
  { q: 'Snake-Eye link monsters', reply: { query: { mode: 'cards', card_filter: { archetypes: ['Snake-Eye'], monster_kinds: ['link'] } } } },
  {
    q: 'Send Level 2 Aqua monsters to the GY',
    reply: { query: { mode: 'does', verb: 'send_to_gy', target: { card_types: ['monster'], races: ['Aqua'], level: { op: 'eq', value: 2 } } } },
  },
  { q: 'cards that draw 2', reply: { query: { mode: 'does', verb: 'draw' } } },
  {
    q: 'spells that destroy all monsters on the field',
    reply: {
      query: { mode: 'does', verb: 'destroy', from_zones: ['field'], target: { card_types: ['monster'] }, card_filter: { card_types: ['spell'] } },
    },
  },
  { q: 'cards that mill', reply: { query: { mode: 'does', verb: 'send_to_gy', from_zones: ['deck'] } } },
  {
    q: 'Blue-Eyes support',
    reply: { query: { mode: 'does', verb: 'add_to_hand', target: { archetypes: ['Blue-Eyes'] } } },
  },
  {
    q: "monsters that can't be destroyed by battle",
    reply: { unsupported: 'Protection effects (cannot be destroyed, unaffected) are not searchable yet.' },
  },
  { q: 'what is the best deck right now', reply: { unsupported: 'That is not a question about what card effects do.' } },
];

const termList = (terms: { term: string; description: string }[]) => terms.map((t) => `- ${t.term}: ${t.description}`).join('\n');

export const buildParserPrompt = (
  vocab: PromptVocab,
): string => `You turn a Yu-Gi-Oh! player's search request into a structured query over a database of card effects. Output only JSON.

Return {"query": {...}} or, if the request isn't about Yu-Gi-Oh! cards or what their effects do, {"unsupported": "<short reason>"}.

## Query fields
- mode:
  - "does": what the results' effects do ("cards that special summon X", "cards that search a Frog").
  - "responds_to": what the results' effects trigger on ("cards that activate when X is destroyed").
  - "affected_by": the results are the cards a named card's effects can act on ("cards that can be summoned by X", "what can X search", "targets for X's effect", "what does X special summon"). Put that card in "source" ({"card": "<name as typed>"}, or card fields for a kind of card) and its action in "verb".
  - "cards": the request only describes cards, with no effect to look for ("Level 1 FIRE monsters", "Spellcaster Fusion monsters", "Frog cards"). Put the description in card_filter and set verb null.
- verb: the action ("does", "affected_by") or event ("responds_to"); one of the verbs below; null only in "cards" mode. Searching ("search", "add from deck") is add_to_hand from the deck; "mill" is send_to_gy from the deck; "revive"/"reborn" is special_summon from the GY.
- from_zones / to_zones: zones the request names. from_side: "you" / "opponent" / "either" when the request says whose zone ("your opponent's GY" -> opponent).
- is_cost: true when the request is specifically about costs ("whose cost...", "by paying/discarding as a cost"); otherwise omit.
- target ("does"): what the action applies to. A specific card name -> {"card": "<exact name as typed>"}. A description -> card fields (below). The cards themselves ("special summon themselves", "this card") -> {"card": "__self__"}. Omit when the request doesn't restrict it.
- responds_to: subject_is_self true when the event happens to the card itself ("when this card is sent to the GY"); otherwise "target" describes the card the event happens to. cause ("cost", "effect", "battle", "material") and cause_card describe what caused it.
- card_filter: constraints on the result cards, not on what they affect ("WATER monsters that...", "spells that...", "level 4 or lower warriors that..."). A kind of card after the verb ("take control of a monster", "destroy a spell") is the target, never card_filter.
- Card fields: card_types ${JSON.stringify(CARD_TYPES)}; attributes ${JSON.stringify(ATTRIBUTE_NAMES)}; races ${JSON.stringify(RACE_NAMES)}; monster_kinds ${JSON.stringify(MONSTER_KINDS)}; spell_trap_types ${JSON.stringify(SPELL_TRAP_TYPES)}; level / rank / link_rating / atk / def as {"op": "eq|neq|lt|lte|gt|gte", "value": n}; archetypes (e.g. ["Frog"]); names; exclude_names; exclude_monster_kinds; exclude_attributes / exclude_races ("non-WATER", "non-Machine"); any_of (list of alternatives).
- Leave out anything the request doesn't say. Prefer the broadest reasonable reading.
- Always produce a query when any part of the request maps to the fields: keep the parts you can express and drop the rest (a number of cards, "once per turn", "all"/"every"), rather than answering unsupported.
- archetypes and names are only for real Yu-Gi-Oh! archetypes and card names, never ordinary words ("all", "token", "support").
- "<archetype> support": cards that search or add that archetype (add_to_hand with that archetype as target).
- "cards like <card>" / "<card> but ...": search for what that card's main effect does ("cards like Pot of Greed" -> draw).
- The text of cards the request names may be given before it, as reference. Use it to work out what a named card does ("cards like X", "X's effect"); a card the request uses as a target or source still goes in by name. For "cards like X", keep only X's main action and what it acts on: never its costs (is_cost), conditions or card type, unless the request asks for them. Pick the verb from the text's own wording: "negate the activation" is negate_activation, "negate that effect" is negate_effect.
- "unsupported" is only for requests that aren't about cards at all, or that are only about something no verb covers (protection, continuous restrictions).

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
      props.verb = { type: ['string', 'null'], enum: [...verbs, null] };
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

/** What makes a query unrunnable (mode/verb/source mismatches), or null. */
export const queryProblem = (q: SearchQuery, vocab: Vocab): string | null => {
  if (q.mode === 'cards') return q.card_filter ? null : '"cards" mode needs a card_filter';
  const action = q.mode !== 'responds_to';
  if (!q.verb || !(action ? vocab.actionVerbs : vocab.eventVerbs).includes(q.verb)) {
    return `"${q.verb}" is not ${action ? 'an action' : 'an event'} verb`;
  }
  if (q.mode === 'affected_by' && !q.source) return '"affected_by" mode needs a source';
  return null;
};

const CARD_TYPE_WORDS: Record<string, RegExp> = { monster: /\bmonsters?\b/i, spell: /\bspells?\b/i, trap: /\btraps?\b/i };

/**
 * Drops a card_filter that only names card types the request never puts on the results. The model
 * sometimes copies the target's type there ("cards that take control of an opponent's monster" ->
 * monsters only), which hides every Spell and Trap that does it. The result cards are described before
 * the first "that"/"which"/"with"; a request without one is left alone.
 */
export const dropStrayCardFilter = (request: string, q: SearchQuery): SearchQuery => {
  if (q.mode === 'cards' || !q.card_filter) return q;
  const { card_types, ...rest } = q.card_filter as Record<string, unknown>;
  const onlyTypes = Array.isArray(card_types) && card_types.length && Object.values(rest).every((v) => v == null || (Array.isArray(v) && !v.length));
  if (!onlyTypes) return q;
  const head = request.split(/\b(?:that|which|who|whose|with)\b/i)[0]!;
  if (head === request) return q;
  const asked = (card_types as string[]).some((t) => !CARD_TYPE_WORDS[t] || CARD_TYPE_WORDS[t].test(head));
  return asked ? q : { ...q, card_filter: null };
};

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
    const problem = queryProblem(q, vocab);
    if (problem) return { error: problem };
    const bad = [...q.from_zones, ...q.to_zones].find((z) => !vocab.zones.includes(z));
    if (bad) return { error: `unknown zone "${bad}"` };
  }
  return { reply: parsed.data };
};

/** A card the request names, with its text, given to the model as reference. */
export type NamedCard = { name: string; typeLine: string; text: string };

const NAMED_CARD_TEXT_LIMIT = 700;

/** The user message: reference text for the cards the request names, then the request. */
export const parserUserMessage = (request: string, namedCards: readonly NamedCard[] = []): string => {
  const cards = namedCards.map((c) => `- ${c.name} (${c.typeLine}): ${c.text.replace(/\s+/g, ' ').trim().slice(0, NAMED_CARD_TEXT_LIMIT)}`);
  const ref = cards.length ? `Cards named in the request (reference only):\n${cards.join('\n')}\n\n` : '';
  return `${ref}Request: ${request.trim().slice(0, 300)}\nOutput:`;
};

export type ParserConfig = {
  client: ChatClient;
  model: string;
  systemPrompt: string;
  jsonSchema: Record<string, unknown>;
  vocab: Vocab;
  reasoningEffort?: ReasoningEffort;
  /** Cards the request names (see namedCardsIn), whose text helps with "cards like X". */
  namedCards?: readonly NamedCard[];
  /**
   * Models to try, in order, when `model` is rate limited, down, or keeps returning invalid output. The
   * model's own capacity limits are low enough that busy minutes (or a tagging run) hit them.
   */
  fallbacks?: { model: string; reasoningEffort?: ReasoningEffort }[];
  /** Wait before retrying a transient error (rate limit, 5xx) on the same model. */
  retryDelayMs?: number;
};

type Attempt = { reply: ParserReply } | { error: string };

/**
 * Parses a request: each model gets one corrective retry on invalid output and one retry on a transient
 * error; then the next fallback model gets a go. An "unsupported" reply is an answer, not a failure.
 */
export const parseSearchRequest = async (request: string, cfg: ParserConfig): Promise<ParseResult> => {
  const started = Date.now();
  let usage: ChatUsage | null = null;
  const models = [{ model: cfg.model, reasoningEffort: cfg.reasoningEffort }, ...(cfg.fallbacks ?? [])];
  const errors: string[] = [];

  const tryModel = async (model: string, reasoningEffort: ReasoningEffort | undefined): Promise<Attempt> => {
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: cfg.systemPrompt },
      { role: 'user', content: parserUserMessage(request, cfg.namedCards) },
    ];
    let lastError = '';
    let transientRetried = false;
    for (let attempt = 1; attempt <= 2;) {
      try {
        const res = await cfg.client({
          model,
          messages,
          jsonSchema: { name: 'search_query', schema: cfg.jsonSchema },
          reasoningEffort,
          temperature: 0,
          maxTokens: 1200,
        });
        usage = addUsage(usage ?? ZERO_USAGE, res.usage);
        const checked = checkParserReply(res.content, cfg.vocab);
        if ('reply' in checked) return checked;
        lastError = checked.error;
        messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: `Invalid: ${checked.error}. Return corrected JSON.` });
        attempt++;
      } catch (e) {
        lastError = (e as Error).message;
        if (!(e instanceof ChatError && e.retryable) || transientRetried) return { error: lastError };
        transientRetried = true;
        await new Promise((r) => setTimeout(r, cfg.retryDelayMs ?? 400));
      }
    }
    return { error: lastError };
  };

  for (const m of models) {
    const res = await tryModel(m.model, m.reasoningEffort);
    if ('reply' in res) {
      const reply = 'query' in res.reply ? { query: dropStrayCardFilter(request, res.reply.query) } : res.reply;
      return { ok: true, reply, usage: usage ?? ZERO_USAGE, ms: Date.now() - started };
    }
    errors.push(`${m.model}: ${res.error}`);
  }
  return { ok: false, error: errors.join(' | '), usage, ms: Date.now() - started };
};
