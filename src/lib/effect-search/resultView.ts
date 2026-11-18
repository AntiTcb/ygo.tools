import { attributeName } from '../db/cardEnums';
import type { CardFilterRow } from '../db/cardFilterEval';
import { SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from '../db/cardFilterRule';
import { RACE_BY_ID } from './cardText';
import { ATTRIBUTE_NAMES, RACE_NAMES } from './tagSchema';

/**
 * How the ranked results are shown: facet filters, sort order and page. Lives in its own URL params
 * (not the `ast`), so refining results never calls the model.
 */

export const FACETS = ['kind', 'attribute', 'race', 'archetype'] as const;
export type Facet = (typeof FACETS)[number];

export const CARD_KINDS = ['Monster', 'Spell', 'Trap'] as const;
export const SORTS = ['relevance', 'name', 'atk', 'def', 'level'] as const;
export type Sort = (typeof SORTS)[number];

export const PAGE_SIZE = 100;

export type ResultView = { filters: Record<Facet, string[]>; sort: Sort; page: number };

/** URL param per facet. */
export const FACET_PARAM: Record<Facet, string> = { kind: 'kind', attribute: 'attr', race: 'race', archetype: 'arch' };

const MAX_VALUES = 20;
const MAX_VALUE_LENGTH = 80;

const allowed: Record<Facet, ((v: string) => boolean) | null> = {
  kind: (v) => (CARD_KINDS as readonly string[]).includes(v),
  attribute: (v) => (ATTRIBUTE_NAMES as readonly string[]).includes(v),
  race: (v) => (RACE_NAMES as readonly string[]).includes(v),
  archetype: null,
};

export const parseView = (params: URLSearchParams): ResultView => {
  const filters = Object.fromEntries(
    FACETS.map((f) => {
      const ok = allowed[f];
      const values = params
        .getAll(FACET_PARAM[f])
        .map((v) => v.trim())
        .filter((v) => v && v.length <= MAX_VALUE_LENGTH && (!ok || ok(v)));
      return [f, [...new Set(values)].slice(0, MAX_VALUES)];
    }),
  ) as Record<Facet, string[]>;
  const sortParam = params.get('sort');
  const sort = (SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as Sort) : 'relevance';
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1));
  return { filters, sort, page };
};

/** Writes `view` into `url`, dropping defaults (and the page when it is 1). */
export const writeView = (url: URL, view: ResultView): URL => {
  const out = new URL(url.href);
  for (const f of FACETS) {
    out.searchParams.delete(FACET_PARAM[f]);
    for (const v of view.filters[f]) out.searchParams.append(FACET_PARAM[f], v);
  }
  if (view.sort === 'relevance') out.searchParams.delete('sort');
  else out.searchParams.set('sort', view.sort);
  if (view.page <= 1) out.searchParams.delete('page');
  else out.searchParams.set('page', String(view.page));
  return out;
};

export type ViewCard = CardFilterRow & { name: string };

export const cardKind = (c: Pick<CardFilterRow, 'frame_type_id'>): (typeof CARD_KINDS)[number] =>
  c.frame_type_id === SPELL_FRAME_TYPE_ID ? 'Spell' : c.frame_type_id === TRAP_FRAME_TYPE_ID ? 'Trap' : 'Monster';

const facetValues = (c: ViewCard, f: Facet): string[] => {
  switch (f) {
    case 'kind':
      return [cardKind(c)];
    case 'attribute': {
      const a = cardKind(c) === 'Monster' && c.attribute_id !== null ? attributeName(c.attribute_id) : undefined;
      return a ? [a] : [];
    }
    case 'race': {
      const r = cardKind(c) === 'Monster' && c.species_id !== null ? RACE_BY_ID.get(c.species_id) : undefined;
      return r ? [r] : [];
    }
    case 'archetype':
      return [...(c.archetypes ?? [])];
  }
};

/** Within a facet any selected value matches; across facets all must. */
const passes = (c: ViewCard, filters: Record<Facet, string[]>, skip?: Facet) =>
  FACETS.every((f) => f === skip || !filters[f].length || facetValues(c, f).some((v) => filters[f].includes(v)));

export type FacetCount = { value: string; count: number; selected: boolean };

const ORDER: Record<Facet, readonly string[] | null> = { kind: CARD_KINDS, attribute: ATTRIBUTE_NAMES, race: null, archetype: null };

/** Higher first, missing values last; ties keep the relevance order (the sort is stable). */
const statDesc = (pick: (c: ViewCard) => number | null) => (a: ViewCard, b: ViewCard) => (pick(b) ?? -Infinity) - (pick(a) ?? -Infinity);

const comparators: Record<Exclude<Sort, 'relevance'>, (a: ViewCard, b: ViewCard) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  atk: statDesc((c) => (cardKind(c) === 'Monster' ? c.atk : null)),
  def: statDesc((c) => (cardKind(c) === 'Monster' && !c.link_rating ? c.def : null)),
  level: statDesc((c) => (cardKind(c) === 'Monster' ? (c.link_rating ?? c.level) : null)),
};

export type ViewResult<T> = {
  /** The page of items, in display order. */
  items: T[];
  /** Items left after the filters. */
  matching: number;
  page: number;
  pageCount: number;
  /**
   * Values per facet with how many items each would show, counted with the other facets' filters applied
   * (so the counts are what clicking the value gives). Selected values are always listed.
   */
  facets: Record<Facet, FacetCount[]>;
};

/** Filters, sorts and pages `ranked` (already in relevance order). */
export const applyView = <T>(ranked: readonly T[], cardOf: (item: T) => ViewCard, view: ResultView): ViewResult<T> => {
  const facets = Object.fromEntries(
    FACETS.map((f) => {
      const counts = new Map<string, number>(view.filters[f].map((v) => [v, 0]));
      for (const item of ranked) {
        const c = cardOf(item);
        if (!passes(c, view.filters, f)) continue;
        for (const v of facetValues(c, f)) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const order = ORDER[f];
      const list = [...counts.entries()]
        .map(([value, count]) => ({ value, count, selected: view.filters[f].includes(value) }))
        .sort((a, b) => (order ? order.indexOf(a.value) - order.indexOf(b.value) : b.count - a.count || a.value.localeCompare(b.value)));
      return [f, list];
    }),
  ) as Record<Facet, FacetCount[]>;

  const filtered = ranked.filter((item) => passes(cardOf(item), view.filters));
  const sorted =
    view.sort === 'relevance' ? filtered : filtered.toSorted((a, b) => comparators[view.sort as Exclude<Sort, 'relevance'>](cardOf(a), cardOf(b)));
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(view.page, pageCount);
  return { items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), matching: sorted.length, page, pageCount, facets };
};
