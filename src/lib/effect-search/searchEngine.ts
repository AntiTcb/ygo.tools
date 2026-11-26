import { evalRuleNode } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow, RuleNode } from '../db/cardFilterRule';
import { resolveVirtualRuleTree } from '../db/cardFilterResolve';
import { fetchAll, loadCardPool, type CardPool, type Db, type PoolCard } from './db';
import { cardTypeLine } from './cardText';
import { humanizeAction, humanizeTrigger } from './humanize';
import type { NamedCard } from './queryParser';
import { isNamedCard, SELF, TIERS, type QueryTarget, type SearchQuery, type Tier } from './query';
import { applyView, parseView, type Facet, type FacetCount, type ResultView, type Sort, type ViewCard } from './resultView';
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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The card a typed name means: the exact name (case-insensitive, rename suffix ignored), else the one
 * card whose name starts with it ("Mixousia" -> "Mixousia the Confounder"), else the one card whose
 * name contains it as whole words. Undefined when nothing or several cards fit.
 */
export const lookupCard = (pool: CardPool, name: string): PoolCard | undefined => {
  const typed = name.trim();
  const id = makeNameResolver(pool.names)(typed);
  if (id !== undefined) return pool.byId.get(id);
  const q = typed.toLowerCase().replace(/^"|"$/g, '');
  if (q.length < 4) return undefined;
  const e = escapeRegExp(q);
  for (const re of [new RegExp(`^${e}(?![\\w])`), new RegExp(`(?<![\\w])${e}(?![\\w])`)]) {
    const hits = pool.cards.filter((c) => re.test(currentCardName(c.name).toLowerCase()));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined;
  }
  return undefined;
};

/** Lowercase words only, so "harpies feather duster" matches "Harpie's Feather Duster". */
const foldName = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’"“”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Card names that are also everyday search words ("Reinforcements", "Destruction") would match all the
// time: a one-word name must be long to count.
const MIN_ONE_WORD_NAME = 9;
const MAX_NAMED_CARDS = 3;

const foldedNames = new WeakMap<CardPool, { folded: string; card: PoolCard }[]>();
const foldedNamesOf = (pool: CardPool) => {
  let list = foldedNames.get(pool);
  if (!list) {
    list = pool.cards
      .map((card) => ({ folded: foldName(currentCardName(card.name)), card }))
      .filter(({ folded }) => folded.includes(' ') || folded.length >= MIN_ONE_WORD_NAME)
      // Longest first, so "Pot of Greed" beats a card named "Greed" inside it.
      .sort((a, b) => b.folded.length - a.folded.length);
    foldedNames.set(pool, list);
  }
  return list;
};

/**
 * Cards whose full names appear in a request, longest names first (at most a few). Their text goes to
 * the query parser, so "cards like Pot of Greed" can be read as a draw search.
 */
export const namedCardsIn = (pool: CardPool, request: string): PoolCard[] => {
  let text = ` ${foldName(request)} `;
  const found: PoolCard[] = [];
  for (const { folded, card } of foldedNamesOf(pool)) {
    const at = text.indexOf(` ${folded} `);
    if (at < 0) continue;
    found.push(card);
    if (found.length === MAX_NAMED_CARDS) break;
    // Blank the match out so a shorter name inside it ("Dark Magician" in "Dark Magician Girl") doesn't count.
    text = `${text.slice(0, at + 1)}${'#'.repeat(folded.length)}${text.slice(at + 1 + folded.length)}`;
  }
  if (found.length) return found;
  // A shortened name after "like"/"by"/"can"/"does" ("cards like ash blossom", "what can Mixousia summon"):
  // the longest run of words there that names exactly one card (see lookupCard).
  for (const m of request.matchAll(/\b(?:like|by|can|does)\s+([^,.;?!]+)/gi)) {
    const words = m[1]!.trim().split(/\s+/).slice(0, 6);
    for (let n = words.length; n > 0; n--) {
      const phrase = words.slice(0, n).join(' ');
      if (n === 1 && phrase.length < 6) break;
      const card = lookupCard(pool, phrase);
      if (card) return [card];
    }
  }
  return found;
};

/** The cards a request names, as reference text for the query parser. */
export const parserNamedCards = (pool: CardPool, request: string): NamedCard[] =>
  namedCardsIn(pool, request).map((c) => ({
    name: currentCardName(c.name),
    typeLine: cardTypeLine(c, pool.frameNames),
    text: [c.effect_text, c.pendulum_text].filter(Boolean).join(' / '),
  }));

/** The query with every card name it names replaced by the full name of the card it resolves to. */
export const canonicalNames = (pool: CardPool, q: SearchQuery): SearchQuery => {
  const fix = (t: QueryTarget | null): QueryTarget | null => {
    if (!isNamedCard(t) || t.card === SELF) return t;
    const card = lookupCard(pool, t.card);
    const name = card && currentCardName(card.name);
    return name && name !== t.card ? { card: name } : t;
  };
  const next = { ...q, target: fix(q.target), cause_card: fix(q.cause_card), source: fix(q.source) };
  return next.target === q.target && next.cause_card === q.cause_card && next.source === q.source ? q : next;
};

/** Exact or unambiguous name (see lookupCard) from the pool, else fuzzy suggestions. */
export const resolveTarget = async (db: Db, pool: CardPool, t: QueryTarget | null, matcher: RuleMatcher, key: string): Promise<ResolvedTarget> => {
  if (!t) return { kind: 'none' };
  if (isNamedCard(t)) {
    if (t.card === SELF) return { kind: 'self' };
    const card = lookupCard(pool, t.card);
    if (card) return { kind: 'card', card };
    const { data } = await db.rpc('search_cards', { card_name: t.card.trim() });
    const seen = new Set<number>();
    const suggestions = (data ?? [])
      .filter((r) => r.language === 'en' && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 6)
      .map((r) => ({ id: r.id, name: currentCardName(r.name) }));
    return { kind: 'unknown', name: t.card, suggestions };
  }
  const rule = targetToRule(t, makeNameResolver(pool.names)).rule;
  const cards = pool.cards.filter((c) => matcher.matches(rule, c));
  // A description every card fits ("any card", "a monster, Spell or Trap") asks for nothing in particular.
  if (cards.length === pool.cards.length) return { kind: 'none' };
  return { kind: 'cards', rule, cards, key };
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
    if (v === undefined || k === 'exclude_names') continue;
    // Most verbs only apply to monsters, so "a monster" (or "any card") restricts nothing; "a Spell/Trap" does.
    if (k === 'card_types' && t.card_types?.includes('monster')) continue;
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
      // Acting on itself fits only one of the described cards ("negate the effects of Spells" isn't met by
      // a Spell negating its own effects): rank it with the partial fits, below effects that take any of them.
      if (eff.isSelf) return matcher.matches(want.rule, eff.owner) ? 'partial' : null;
      // An effect naming one of the described cards fits only that one, unless it is the only one described.
      if (eff.nameRefs.some((n) => want.cards.some((c) => c.id === n))) return want.cards.length === 1 ? 'name' : 'partial';
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
  card: { id: number; name: string; typeLine: string };
  tier: Tier;
  /** Up to three matching effects: the sentence and a one-line reading of what matched. */
  reasons: { snippet: string; why: string; note: string | null }[];
};

export type SearchResponse =
  | {
      kind: 'results';
      /** The current page, in display order. */
      hits: SearchHit[];
      /** Cards matching the query, before the result filters. */
      total: number;
      /** Cards left after the result filters. */
      matching: number;
      page: number;
      pageCount: number;
      sort: Sort;
      facets: Record<Facet, FacetCount[]>;
    }
  | { kind: 'unknown_card'; field: 'target' | 'cause_card' | 'source'; name: string; suggestions: { id: number; name: string }[] };

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

const SUMMON_VERBS: ReadonlySet<string> = new Set(['special_summon', 'normal_summon', 'flip_summon']);
const EXTRA_DECK_KINDS = ['fusion', 'synchro', 'xyz', 'link'] as const;

const makeRuleCheck = (t: Target, pool: CardPool, matcher: RuleMatcher) => {
  const rule = targetToRule(t, makeNameResolver(pool.names)).rule;
  return (c: PoolCard) => matcher.matches(rule, c);
};

/** Runs a parsed query against the stored tags, then filters, sorts and pages the results per `view`. */
export const runSearch = async (db: Db, query: SearchQuery, view: ResultView = parseView(new URLSearchParams())): Promise<SearchResponse> => {
  const pool = await getCardPool(db);
  const matcher = new RuleMatcher(pool.complexRows);

  const [verbs, zones] = await Promise.all([db.from('effect_vocab_verbs').select('id,term'), db.from('effect_vocab_zones').select('id,term')]);
  if (verbs.error) throw new Error(verbs.error.message);
  if (zones.error) throw new Error(zones.error.message);
  const verbId = verbs.data.find((v) => v.term === query.verb)?.id;
  const zoneIds = (terms: string[]) => terms.map((t) => zones.data.find((z) => z.term === t)?.id).filter((x): x is number => x !== undefined);
  const zoneTerm = new Map(zones.data.map((z) => [z.id, z.term]));
  if (verbId === undefined && query.mode !== 'cards') {
    const { items, ...pageInfo } = applyView<SearchHit>([], (h) => h as never, view);
    return { kind: 'results', ...pageInfo, hits: items, total: 0, sort: view.sort };
  }

  const target = await resolveTarget(db, pool, query.target, matcher, 'target');
  if (target.kind === 'unknown') return { kind: 'unknown_card', field: 'target', name: target.name, suggestions: target.suggestions };
  const filterRule = query.card_filter ? targetToRule(query.card_filter, makeNameResolver(pool.names)).rule : null;
  const passesFilter = (card: PoolCard) => !filterRule || matcher.matches(filterRule, card);

  type Found = { cardId: number; effectId: number; tier: Tier; specificity: number; why: string; note: string | null };
  const found: Found[] = [];
  /** "cards" mode: cards that match without any effect to show. */
  const plain: number[] = [];

  const fetchActions = (ownerIds: number[] | null) => {
    const from = zoneIds(query.from_zones);
    const to = zoneIds(query.to_zones);
    const select =
      'card_id,effect_id,is_self,is_cost,target,target_rule,name_refs,contextual,context_note,from_zones,to_zones,from_side,to_side,quantity,stat,stat_mode,stat_amount,stat_amount_note';
    const page = (ids: number[] | null) =>
      fetchAll<ActionRow>((f, t) => {
        let q = db.from('effect_actions').select(select).eq('verb_id', verbId!);
        if (ids) q = q.in('card_id', ids);
        if (from.length) q = q.overlaps('from_zones', from);
        if (to.length) q = q.overlaps('to_zones', to);
        if (query.is_cost !== null) q = q.eq('is_cost', query.is_cost);
        return q.order('id').range(f, t);
      });
    if (!ownerIds) return page(null);
    const chunks: number[][] = [];
    for (let i = 0; i < ownerIds.length; i += 200) chunks.push(ownerIds.slice(i, i + 200));
    return Promise.all(chunks.map(page)).then((r) => r.flat());
  };

  const describeAction = (a: ActionRow) =>
    humanizeAction({
      ...a,
      verb: query.verb,
      from_zones: a.from_zones.map((z) => zoneTerm.get(z) ?? '?'),
      to_zones: a.to_zones.map((z) => zoneTerm.get(z) ?? '?'),
      target: a.target as Target | null,
      name_refs: a.name_refs.map((id) => currentCardName(pool.byId.get(id)?.name ?? `#${id}`)),
    } as unknown as TagAction);

  if (query.mode === 'cards') {
    for (const c of pool.cards) if (passesFilter(c)) plain.push(c.id);
  } else if (query.mode === 'affected_by') {
    const source = await resolveTarget(db, pool, query.source, matcher, 'source');
    if (source.kind === 'unknown') return { kind: 'unknown_card', field: 'source', name: source.name, suggestions: source.suggestions };
    const owners = source.kind === 'card' ? [source.card] : source.kind === 'cards' ? source.cards : [];
    const rows = owners.length ? await fetchActions(owners.map((o) => o.id)) : [];
    // What the verb and zones imply about the affected cards: summons move monsters; the hand and Deck hold no
    // Extra Deck monsters; the Extra Deck holds nothing else.
    const isMonster = makeRuleCheck({ card_types: ['monster'] }, pool, matcher);
    const isExtraDeck = makeRuleCheck({ monster_kinds: [...EXTRA_DECK_KINDS] }, pool, matcher);
    const isPendulum = makeRuleCheck({ monster_kinds: ['pendulum'] }, pool, matcher);
    const base = pool.cards.filter((c) => passesFilter(c) && (!SUMMON_VERBS.has(query.verb!) || isMonster(c)));
    // The action's zones narrow what it can reach: the hand and Deck hold no Extra Deck monsters, and the
    // Extra Deck holds only those (and face-up Pendulums).
    const zonePools = new Map<string, PoolCard[]>();
    const reachable = (zones: string[]) => {
      const key = [...zones].sort().join(',');
      let set = zonePools.get(key);
      if (!set) {
        set =
          zones.length && zones.every((z) => z === 'hand' || z === 'deck')
            ? base.filter((c) => !isExtraDeck(c))
            : zones.length && zones.every((z) => z === 'extra_deck')
              ? base.filter((c) => isExtraDeck(c) || isPendulum(c))
              : base;
        zonePools.set(key, set);
      }
      return set;
    };
    const matchSets = new Map<string, PoolCard[]>();
    const matching = (rule: RuleNode | null, zones: string[]) => {
      const key = `${[...zones].sort().join(',')}\u0000${JSON.stringify(rule)}`;
      let set = matchSets.get(key);
      if (!set) {
        set = rule ? reachable(zones).filter((c) => matcher.matches(rule, c)) : reachable(zones);
        matchSets.set(key, set);
      }
      return set;
    };
    const baseIds = new Set(base.map((c) => c.id));
    for (const a of rows) {
      const owner = pool.byId.get(a.card_id)!;
      if (!sideOk(query.from_side, a.from_side) || !sideOk(query.to_side, a.to_side)) continue;
      const why = `${owners.length > 1 ? `${currentCardName(owner.name)}: ` : ''}${describeAction(a)}`;
      const note = a.contextual ? a.context_note : null;
      const specificity = targetSpecificity(a.target as Target | null);
      const push = (cardId: number, tier: Tier) => found.push({ cardId, effectId: a.effect_id, tier, specificity, why, note });
      if (a.is_self) {
        if (baseIds.has(owner.id)) push(owner.id, 'self');
        continue;
      }
      for (const id of a.name_refs) if (baseIds.has(id)) push(id, 'name');
      const rule = a.target_rule as RuleNode | null;
      // An action on named cards only ("Special Summon 1 "Toadally Awesome"") affects nothing else.
      if (!rule && a.name_refs.length) continue;
      const tier: Tier = !rule || specificity === 0 ? 'unrestricted' : a.contextual ? 'contextual' : 'property';
      const zones = a.from_zones.map((z) => zoneTerm.get(z) ?? '?');
      for (const c of matching(rule, zones)) if (c.id !== owner.id && !a.name_refs.includes(c.id)) push(c.id, tier);
    }
  } else if (query.mode === 'does') {
    const rows = await fetchActions(null);
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
      found.push({
        cardId: a.card_id,
        effectId: a.effect_id,
        tier,
        specificity,
        why: describeAction(a),
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
        .eq('event_verb_id', verbId!);
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
        why: humanizeTrigger(trigger),
        note: null,
      });
    }
  }

  // Best tier per card, with that tier's effects as the reasons.
  const byCard = new Map<number, Found[]>();
  for (const f of found) {
    const fs = byCard.get(f.cardId);
    if (fs) fs.push(f);
    else byCard.set(f.cardId, [f]);
  }
  const ranked = [...byCard.entries()]
    .map(([cardId, fs]): { cardId: number; tier: Tier; specificity: number; effects: Found[] } => {
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
    .concat(plain.map((cardId) => ({ cardId, tier: 'match' as Tier, specificity: 0, effects: [] })))
    // Within a tier, narrower targets first: "Special Summon 1 Aqua monster" before "1 monster".
    .sort(
      (a, b) =>
        rank(a.tier) - rank(b.tier) ||
        b.specificity - a.specificity ||
        currentCardName(pool.byId.get(a.cardId)!.name).localeCompare(currentCardName(pool.byId.get(b.cardId)!.name)),
    );
  const viewCards = new Map<number, ViewCard>(
    ranked.map(({ cardId }) => {
      const c = pool.byId.get(cardId)!;
      return [cardId, { ...c, name: currentCardName(c.name) }];
    }),
  );
  const { items: shown, ...pageInfo } = applyView(ranked, (r) => viewCards.get(r.cardId)!, view);

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
    ...pageInfo,
    total: ranked.length,
    sort: view.sort,
    hits: shown.map((r) => ({
      card: { id: r.cardId, name: viewCards.get(r.cardId)!.name, typeLine: cardTypeLine(pool.byId.get(r.cardId)!, pool.frameNames) },
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

/** Every archetype name, sorted (for the query editor's suggestions). */
export const archetypeNames = async (db: Db): Promise<string[]> =>
  [...new Set((await getCardPool(db)).cards.flatMap((c) => c.archetypes ?? []))].sort((a, b) => a.localeCompare(b));
