import { evalRuleNode } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow, RuleNode } from '../db/cardFilterRule';
import { resolveVirtualRuleTree } from '../db/cardFilterResolve';
import { fetchAll, loadCardPool, type CardPool, type Db, type PoolCard } from './db';
import { describeAction, describeTrigger } from './describe';
import { isNamedCard, SELF, TIERS, type QueryTarget, type SearchQuery, type Tier } from './query';
import { currentCardName, makeNameResolver } from './store';
import { targetToRule } from './targetRule';
import type { TagAction, TagTrigger, Target } from './tagSchema';

const rank = (t: Tier) => TIERS.indexOf(t);
/** Combines two conditions on one effect: the weaker match wins ('match' means no condition yet). */
const combine = (a: Tier, b: Tier): Tier => (a === 'match' ? b : rank(a) >= rank(b) ? a : b);

// ---------------------------------------------------------------------------
// Card pool, cached per isolate (Workers reuse isolates across requests).
// ---------------------------------------------------------------------------

const POOL_TTL_MS = 60 * 60 * 1000;
let poolCache: { pool: Promise<CardPool>; at: number } | null = null;

export const getCardPool = (db: Db): Promise<CardPool> => {
  if (!poolCache || Date.now() - poolCache.at > POOL_TTL_MS) {
    const pool = loadCardPool(db);
    poolCache = { pool, at: Date.now() };
    pool.catch(() => (poolCache = null));
  }
  return poolCache.pool;
};

/** Rule evaluation with per-rule caches of the virtual-field resolution and of match sets. */
export class RuleMatcher {
  private resolved = new Map<string, RuleNode>();
  private overlap = new Map<string, boolean>();
  private cover = new Map<string, boolean>();
  constructor(private readonly complexRows: ComplexFrameTypeRow[]) {}

  private resolve(rule: RuleNode): RuleNode {
    const key = JSON.stringify(rule);
    let r = this.resolved.get(key);
    if (!r) {
      r = resolveVirtualRuleTree(rule, this.complexRows);
      this.resolved.set(key, r);
    }
    return r;
  }

  matches(rule: RuleNode, card: PoolCard): boolean {
    return evalRuleNode(card, this.resolve(rule));
  }

  /** Does any of `cards` (the cards the query describes) satisfy `rule`? */
  anyMatch(rule: RuleNode, cards: PoolCard[], setKey: string): boolean {
    const key = `${setKey}\u0000${JSON.stringify(rule)}`;
    let hit = this.overlap.get(key);
    if (hit === undefined) {
      const r = this.resolve(rule);
      hit = cards.some((c) => evalRuleNode(c, r));
      this.overlap.set(key, hit);
    }
    return hit;
  }

  /** Do all of `cards` satisfy `rule` (the effect works on everything the query describes)? */
  allMatch(rule: RuleNode, cards: PoolCard[], setKey: string): boolean {
    const key = `${setKey}\u0000${JSON.stringify(rule)}`;
    let all = this.cover.get(key);
    if (all === undefined) {
      const r = this.resolve(rule);
      all = cards.every((c) => evalRuleNode(c, r));
      this.cover.set(key, all);
    }
    return all;
  }
}

// ---------------------------------------------------------------------------
// Resolving what the query is about
// ---------------------------------------------------------------------------

/** A query target resolved against the card pool. */
export type ResolvedTarget =
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'card'; card: PoolCard }
  | { kind: 'cards'; rule: RuleNode; cards: PoolCard[]; key: string }
  | { kind: 'unknown'; name: string; suggestions: { id: number; name: string }[] };

/** Exact name (case-insensitive, rename suffix ignored) from the pool, else fuzzy suggestions. */
export const resolveTarget = async (db: Db, pool: CardPool, t: QueryTarget | null, matcher: RuleMatcher, key: string): Promise<ResolvedTarget> => {
  if (!t) return { kind: 'none' };
  if (isNamedCard(t)) {
    if (t.card === SELF) return { kind: 'self' };
    const id = makeNameResolver(pool.names)(t.card.trim());
    if (id !== undefined) return { kind: 'card', card: pool.byId.get(id)! };
    const { data } = await db.rpc('search_cards', { card_name: t.card.trim() });
    const seen = new Set<number>();
    const suggestions = (data ?? [])
      .filter((r) => r.language === 'en' && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 6)
      .map((r) => ({ id: r.id, name: currentCardName(r.name) }));
    return { kind: 'unknown', name: t.card, suggestions };
  }
  const rule = targetToRule(t, makeNameResolver(pool.names)).rule;
  return { kind: 'cards', rule, cards: pool.cards.filter((c) => matcher.matches(rule, c)), key };
};

const MONSTER_KIND_COUNT = 14;

/**
 * How narrow a stored target is: 0 when it only restricts card type (and maybe excludes names), which
 * is no real restriction for matching purposes; otherwise the number of restricting fields.
 */
export const targetSpecificity = (t: Target | null): number => {
  if (!t) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined || k === 'card_types' || k === 'exclude_names') continue;
    if (k === 'monster_kinds' && Array.isArray(v) && v.length >= MONSTER_KIND_COUNT - 2) continue;
    n++;
  }
  return n;
};

/**
 * How an effect's target (`rule`, `nameRefs`, `isSelf`) relates to what the query asked for, or null
 * when it can't apply. `owner` is the card the effect is on.
 */
export const classify = (
  want: ResolvedTarget,
  eff: { rule: RuleNode | null; specificity: number; nameRefs: readonly number[]; isSelf: boolean; contextual: boolean; owner: PoolCard },
  matcher: RuleMatcher,
): Tier | null => {
  switch (want.kind) {
    case 'none':
      return 'match';
    case 'self':
      return eff.isSelf ? 'match' : null;
    case 'unknown':
      return null;
    case 'card': {
      const id = want.card.id;
      if (eff.isSelf) return eff.owner.id === id ? 'self' : null;
      if (eff.nameRefs.includes(id)) return 'name';
      if (!eff.rule) return 'unrestricted';
      if (!matcher.matches(eff.rule, want.card)) return null;
      if (eff.specificity === 0) return 'unrestricted';
      return eff.contextual ? 'contextual' : 'property';
    }
    case 'cards': {
      if (eff.isSelf) return matcher.matches(want.rule, eff.owner) ? 'property' : null;
      if (eff.nameRefs.some((n) => want.cards.some((c) => c.id === n))) return 'name';
      if (!eff.rule) return 'unrestricted';
      if (!matcher.anyMatch(eff.rule, want.cards, want.key)) return null;
      if (eff.specificity === 0) return 'unrestricted';
      // "a Dragon monster" covers only some "WATER monsters" (the WATER Dragons).
      if (!matcher.allMatch(eff.rule, want.cards, want.key)) return 'partial';
      return eff.contextual ? 'contextual' : 'property';
    }
  }
};

// ---------------------------------------------------------------------------
// Running a query
// ---------------------------------------------------------------------------

export type SearchHit = {
  card: { id: number; name: string };
  tier: Tier;
  /** Up to three matching effects: the sentence and a one-line reading of what matched. */
  reasons: { snippet: string; why: string; note: string | null }[];
};

export type SearchResponse =
  | { kind: 'results'; hits: SearchHit[]; total: number; truncated: boolean }
  | { kind: 'unknown_card'; field: 'target' | 'cause_card'; name: string; suggestions: { id: number; name: string }[] };

const MAX_HITS = 400;

const sideOk = (want: SearchQuery['from_side'], got: string | null) => !want || got === null || got === want || got === 'either' || want === 'either';

type ActionRow = {
  card_id: number;
  effect_id: number;
  is_self: boolean;
  is_cost: boolean;
  target: unknown;
  target_rule: unknown;
  name_refs: number[];
  contextual: boolean;
  context_note: string | null;
  from_zones: number[];
  to_zones: number[];
  from_side: string | null;
  to_side: string | null;
  quantity: number | null;
  stat: string | null;
  stat_mode: string | null;
  stat_amount: number | null;
  stat_amount_note: string | null;
};

type TriggerRow = {
  card_id: number;
  effect_id: number;
  subject_is_self: boolean;
  subject: unknown;
  subject_rule: unknown;
  from_zones: number[];
  subject_side: string | null;
  cause: string | null;
  cause_side: string | null;
  cause_card: unknown;
  cause_card_rule: unknown;
};

/** Runs a parsed query against the stored tags. */
export const runSearch = async (db: Db, query: SearchQuery): Promise<SearchResponse> => {
  const pool = await getCardPool(db);
  const matcher = new RuleMatcher(pool.complexRows);

  const [verbs, zones] = await Promise.all([db.from('effect_vocab_verbs').select('id,term'), db.from('effect_vocab_zones').select('id,term')]);
  if (verbs.error) throw new Error(verbs.error.message);
  if (zones.error) throw new Error(zones.error.message);
  const verbId = verbs.data.find((v) => v.term === query.verb)?.id;
  const zoneIds = (terms: string[]) => terms.map((t) => zones.data.find((z) => z.term === t)?.id).filter((x): x is number => x !== undefined);
  const zoneTerm = new Map(zones.data.map((z) => [z.id, z.term]));
  if (verbId === undefined) return { kind: 'results', hits: [], total: 0, truncated: false };

  const target = await resolveTarget(db, pool, query.target, matcher, 'target');
  if (target.kind === 'unknown') return { kind: 'unknown_card', field: 'target', name: target.name, suggestions: target.suggestions };
  const filterRule = query.card_filter ? targetToRule(query.card_filter, makeNameResolver(pool.names)).rule : null;
  const passesFilter = (card: PoolCard) => !filterRule || matcher.matches(filterRule, card);

  type Found = { cardId: number; effectId: number; tier: Tier; specificity: number; why: string; note: string | null };
  const found: Found[] = [];

  if (query.mode === 'does') {
    const from = zoneIds(query.from_zones);
    const to = zoneIds(query.to_zones);
    const rows = await fetchAll<ActionRow>((f, t) => {
      let q = db
        .from('effect_actions')
        .select(
          'card_id,effect_id,is_self,is_cost,target,target_rule,name_refs,contextual,context_note,from_zones,to_zones,from_side,to_side,quantity,stat,stat_mode,stat_amount,stat_amount_note',
        )
        .eq('verb_id', verbId);
      if (from.length) q = q.overlaps('from_zones', from);
      if (to.length) q = q.overlaps('to_zones', to);
      if (query.is_cost !== null) q = q.eq('is_cost', query.is_cost);
      return q.order('id').range(f, t);
    });
    for (const a of rows) {
      const owner = pool.byId.get(a.card_id);
      if (!owner || !passesFilter(owner)) continue;
      if (!sideOk(query.from_side, a.from_side) || !sideOk(query.to_side, a.to_side)) continue;
      const specificity = targetSpecificity(a.target as Target | null);
      const tier = classify(
        target,
        { rule: a.target_rule as RuleNode | null, specificity, nameRefs: a.name_refs, isSelf: a.is_self, contextual: a.contextual, owner },
        matcher,
      );
      if (!tier) continue;
      const action = {
        ...a,
        verb: query.verb,
        from_zones: a.from_zones.map((z) => zoneTerm.get(z) ?? '?'),
        to_zones: a.to_zones.map((z) => zoneTerm.get(z) ?? '?'),
        target: a.target as Target | null,
        name_refs: a.name_refs.map((id) => currentCardName(pool.byId.get(id)?.name ?? `#${id}`)),
      } as unknown as TagAction;
      found.push({
        cardId: a.card_id,
        effectId: a.effect_id,
        tier,
        specificity,
        why: describeAction(action),
        note: a.contextual ? a.context_note : null,
      });
    }
  } else {
    const cause = await resolveTarget(db, pool, query.cause_card, matcher, 'cause');
    if (cause.kind === 'unknown') return { kind: 'unknown_card', field: 'cause_card', name: cause.name, suggestions: cause.suggestions };
    const from = zoneIds(query.from_zones);
    const rows = await fetchAll<TriggerRow>((f, t) => {
      let q = db
        .from('effect_triggers')
        .select('card_id,effect_id,subject_is_self,subject,subject_rule,from_zones,subject_side,cause,cause_side,cause_card,cause_card_rule')
        .eq('event_verb_id', verbId);
      if (from.length) q = q.overlaps('from_zones', from);
      if (query.cause) q = q.eq('cause', query.cause);
      if (query.subject_is_self) q = q.eq('subject_is_self', true);
      return q.order('id').range(f, t);
    });
    for (const r of rows) {
      const owner = pool.byId.get(r.card_id);
      if (!owner || !passesFilter(owner)) continue;
      if (!sideOk(query.from_side, r.subject_side)) continue;
      let tier: Tier = 'match';
      if (!query.subject_is_self && target.kind !== 'none') {
        const t = classify(
          target,
          {
            rule: r.subject_rule as RuleNode | null,
            specificity: targetSpecificity(r.subject as Target | null),
            nameRefs: [],
            isSelf: r.subject_is_self,
            contextual: false,
            owner,
          },
          matcher,
        );
        if (!t) continue;
        tier = combine(tier, t);
      }
      if (cause.kind !== 'none') {
        const t = classify(
          cause,
          {
            rule: r.cause_card_rule as RuleNode | null,
            specificity: targetSpecificity(r.cause_card as Target | null),
            nameRefs: [],
            isSelf: false,
            contextual: false,
            owner,
          },
          matcher,
        );
        if (!t) continue;
        tier = combine(tier, t);
      }
      const trigger = {
        ...r,
        event: query.verb,
        from_zones: r.from_zones.map((z) => zoneTerm.get(z) ?? '?'),
        subject: r.subject as Target | null,
        cause_card: r.cause_card as Target | null,
      } as unknown as TagTrigger;
      found.push({
        cardId: r.card_id,
        effectId: r.effect_id,
        tier,
        specificity: targetSpecificity(r.subject as Target | null) + targetSpecificity(r.cause_card as Target | null),
        why: `when ${describeTrigger(trigger)}`,
        note: null,
      });
    }
  }

  // Best tier per card, with that tier's effects as the reasons.
  const byCard = new Map<number, Found[]>();
  for (const f of found) byCard.set(f.cardId, [...(byCard.get(f.cardId) ?? []), f]);
  const ranked = [...byCard.entries()]
    .map(([cardId, fs]) => {
      const best = fs.reduce((b, f) => (rank(f.tier) < rank(b) ? f.tier : b), fs[0]!.tier);
      // One effect can hold several matching actions with the same description; show each reason once.
      const seen = new Set<string>();
      const effects = fs
        .filter((f) => f.tier === best)
        .sort((x, y) => y.specificity - x.specificity)
        .filter((f) => {
          const key = `${f.effectId}|${f.why}|${f.note ?? ''}`;
          return !seen.has(key) && Boolean(seen.add(key));
        });
      return { cardId, tier: best, specificity: effects[0]!.specificity, effects };
    })
    // Within a tier, narrower targets first: "Special Summon 1 Aqua monster" before "1 monster".
    .sort(
      (a, b) =>
        rank(a.tier) - rank(b.tier) ||
        b.specificity - a.specificity ||
        currentCardName(pool.byId.get(a.cardId)!.name).localeCompare(currentCardName(pool.byId.get(b.cardId)!.name)),
    );
  const shown = ranked.slice(0, MAX_HITS);

  const effectIds = [...new Set(shown.flatMap((r) => r.effects.slice(0, 3).map((e) => e.effectId)))];
  const snippets = new Map<number, string>();
  for (let i = 0; i < effectIds.length; i += 200) {
    const { data, error } = await db
      .from('effect_effects')
      .select('id,snippet')
      .in('id', effectIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    for (const e of data) snippets.set(e.id, e.snippet);
  }

  return {
    kind: 'results',
    total: ranked.length,
    truncated: ranked.length > shown.length,
    hits: shown.map((r) => ({
      card: { id: r.cardId, name: currentCardName(pool.byId.get(r.cardId)!.name) },
      tier: r.tier,
      reasons: r.effects.slice(0, 3).map((e) => ({ snippet: snippets.get(e.effectId) ?? '', why: e.why, note: e.note })),
    })),
  };
};

// ---------------------------------------------------------------------------
// Full-text fallback (when the parser can't express a request)
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the',
  'and',
  'that',
  'can',
  'cards',
  'card',
  'with',
  'from',
  'your',
  'which',
  'what',
  'monsters',
  'monster',
  'effects',
  'effect',
]);

/** Cards whose text contains every meaningful word of the request. */
export const textSearch = async (db: Db, request: string, limit = 60): Promise<{ id: number; name: string }[]> => {
  const words = [...new Set(request.toLowerCase().match(/[a-z0-9★☆-]{3,}/g) ?? [])].filter((w) => !STOP_WORDS.has(w)).slice(0, 6);
  if (!words.length) return [];
  let q = db.from('neuron_cards').select('id,name').eq('language', 'en');
  for (const w of words) q = q.ilike('effect_text', `%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, error } = await q.order('name').limit(limit);
  if (error) throw new Error(error.message);
  return data.map((c) => ({ id: c.id, name: currentCardName(c.name) }));
};
