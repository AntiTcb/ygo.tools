import { z } from 'zod';
import { describeTarget } from './targetRule';
import { targetSchema } from './tagSchema';

/**
 * A /search query: what the query parser LLM produces from natural language, and what the URL
 * carries (`ast`) so shared links and chip edits skip the LLM. It mirrors the stored tags, so the
 * matching engine (searchEngine.ts) can run it without another model call.
 */

const sideSchema = z.enum(['you', 'opponent', 'either']);

/** "Toadally Awesome" (a specific card) or a description of a card. */
export const queryTargetSchema = z.union([z.object({ card: z.string().min(1) }).strict(), targetSchema]);

export type QueryTarget = z.infer<typeof queryTargetSchema>;

export const isNamedCard = (t: QueryTarget | null | undefined): t is { card: string } => Boolean(t && 'card' in t && typeof t.card === 'string');

export const searchQuerySchema = z.object({
  /** "does": cards whose effects perform the verb; "responds_to": cards whose effects trigger on it. */
  mode: z.enum(['does', 'responds_to']),
  verb: z.string().min(1),
  from_zones: z.array(z.string()).default([]),
  to_zones: z.array(z.string()).default([]),
  from_side: sideSchema.nullable().default(null),
  to_side: sideSchema.nullable().default(null),
  /** does: only costs (true), only non-costs (false), either (null). */
  is_cost: z.boolean().nullable().default(null),
  /** does: what the action applies to. responds_to: the card the event happens to. */
  target: queryTargetSchema.nullable().default(null),
  /** responds_to: the event happens to the card itself ("when this card is sent to the GY"). */
  subject_is_self: z.boolean().nullable().default(null),
  /** responds_to: how the event was caused. */
  cause: z.enum(['cost', 'effect', 'battle', 'material']).nullable().default(null),
  /** responds_to: the card whose effect/summon caused the event ("a WATER monster's effect"). */
  cause_card: queryTargetSchema.nullable().default(null),
  /** Constraints on the result cards themselves ("WATER monsters that..."). */
  card_filter: z
    .lazy(() => targetSchema)
    .nullable()
    .default(null),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchQueryInput = z.input<typeof searchQuerySchema>;

/** What the parser returns when the request isn't about card effects it can express. */
export const parserReplySchema = z.union([z.object({ query: searchQuerySchema }), z.object({ unsupported: z.string().min(1) })]);

export type ParserReply = z.infer<typeof parserReplySchema>;

/** The query target meaning "the card itself" ("monsters that special summon themselves"). */
export const SELF = '__self__';

/**
 * How a card matched, best first:
 * - name: its effect names the card you asked about
 * - self: the card you asked about does it to itself
 * - property: the effect's target restrictions fit (by stats, Type, archetype, ...)
 * - contextual: fits, but also depends on game state (see the note)
 * - partial: the effect's restrictions fit only some of the cards the query describes
 * - unrestricted: the effect works on any card (e.g. "Special Summon 1 monster from your GY")
 * - match: no target was asked about; the effect does what was asked
 */
export const TIERS = ['name', 'self', 'property', 'contextual', 'partial', 'unrestricted', 'match'] as const;
export type Tier = (typeof TIERS)[number];

// ---------------------------------------------------------------------------
// URL encoding: compact JSON in base64url, versioned so old links can be rejected cleanly.
// ---------------------------------------------------------------------------

const AST_VERSION = 1;

const toBase64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const fromBase64Url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** Drops default-valued fields so URLs stay short. */
const compact = (q: SearchQuery): Record<string, unknown> =>
  Object.fromEntries(Object.entries(q).filter(([, v]) => v !== null && v !== false && !(Array.isArray(v) && v.length === 0)) as [string, unknown][]);

export const encodeQuery = (q: SearchQuery): string => toBase64Url(JSON.stringify({ v: AST_VERSION, ...compact(q) }));

/** Returns null for anything malformed (hand-edited or stale links), never throws. */
export const decodeQuery = (raw: string | null | undefined): SearchQuery | null => {
  if (!raw || raw.length > 4000) return null;
  try {
    const { v, ...rest } = JSON.parse(fromBase64Url(raw)) as { v?: unknown };
    if (v !== AST_VERSION) return null;
    const parsed = searchQuerySchema.safeParse(rest);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// English rendering for the chips and the page title
// ---------------------------------------------------------------------------

const sideWord = { you: 'your', opponent: "your opponent's", either: 'either player’s' } as const;

export const describeQueryTarget = (t: QueryTarget | null): string => (!t ? 'any card' : isNamedCard(t) ? `"${t.card}"` : describeTarget(t));

export const describeQuery = (q: SearchQuery): string => {
  const verb = q.verb.replaceAll('_', ' ');
  const zones = q.from_zones.length ? ` from ${q.from_side ? `${sideWord[q.from_side]} ` : ''}${q.from_zones.join('/')}` : '';
  const filter = q.card_filter ? `${describeTarget(q.card_filter)}s` : 'Cards';
  if (q.mode === 'does') {
    const cost = q.is_cost === true ? ' as a cost' : q.is_cost === false ? ' (not as a cost)' : '';
    return `${filter} that ${verb} ${describeQueryTarget(q.target)}${zones}${cost}`;
  }
  const subject = q.subject_is_self ? 'themselves' : describeQueryTarget(q.target);
  const cause = q.cause ? ` by ${q.cause}${q.cause_card ? ` of ${describeQueryTarget(q.cause_card)}` : ''}` : '';
  return `${filter} that respond to ${verb} of ${subject}${zones}${cause}`;
};
