import { describe, expect, it } from 'vitest';
import { applyView, PAGE_SIZE, parseView, writeView, type ResultView, type ViewCard } from './resultView';

const base: ViewCard = {
  id: 0,
  name: '',
  atk: null,
  def: null,
  level: null,
  link_rating: null,
  pend_scale_l: null,
  pend_scale_r: null,
  attribute_id: null,
  species_id: null,
  frame_type_id: 1,
  effect_id: null,
  link_arrows: null,
  pendulum_text: null,
};

// WATER = 3, DARK = 2; Aqua = 14, Fiend = 3; Spell frame = 13, Trap frame = 14.
const cards: ViewCard[] = [
  { ...base, id: 1, name: 'Toadally Awesome', attribute_id: 3, species_id: 14, level: 2, atk: 2200, def: 0, archetypes: ['Frog'] },
  { ...base, id: 2, name: 'Dupe Frog', attribute_id: 3, species_id: 14, level: 2, atk: 100, def: 2000, archetypes: ['Frog'] },
  { ...base, id: 3, name: 'Archfiend', attribute_id: 2, species_id: 3, level: 6, atk: 2500, def: 1200 },
  { ...base, id: 4, name: 'Salvage', frame_type_id: 13 },
  { ...base, id: 5, name: 'Return of the Frogs', frame_type_id: 14, archetypes: ['Frog'] },
];

const view = (patch: Partial<Omit<ResultView, 'filters'>> & { filters?: Partial<ResultView['filters']> } = {}): ResultView => ({
  sort: patch.sort ?? 'relevance',
  page: patch.page ?? 1,
  filters: { kind: [], attribute: [], race: [], archetype: [], ...patch.filters },
});

const run = (v: ResultView, list = cards) => applyView(list, (c) => c, v);

describe('applyView', () => {
  it('keeps relevance order and counts every facet when unfiltered', () => {
    const r = run(view());
    expect(r.items.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    expect(r.facets.kind).toEqual([
      { value: 'Monster', count: 3, selected: false },
      { value: 'Spell', count: 1, selected: false },
      { value: 'Trap', count: 1, selected: false },
    ]);
    expect(r.facets.attribute.map((f) => f.value)).toEqual(['DARK', 'WATER']);
    expect(r.facets.archetype).toEqual([{ value: 'Frog', count: 3, selected: false }]);
  });

  it('ORs values within a facet and ANDs facets', () => {
    expect(run(view({ filters: { kind: ['Spell', 'Trap'] } })).items.map((c) => c.id)).toEqual([4, 5]);
    expect(run(view({ filters: { kind: ['Monster'], archetype: ['Frog'] } })).items.map((c) => c.id)).toEqual([1, 2]);
  });

  it('counts each facet with the other facets applied', () => {
    const r = run(view({ filters: { archetype: ['Frog'], kind: ['Monster'] } }));
    // Kinds among Frog cards: 2 monsters, 1 trap.
    expect(r.facets.kind).toEqual([
      { value: 'Monster', count: 2, selected: true },
      { value: 'Trap', count: 1, selected: false },
    ]);
    // Archetypes among monsters: Frog only (Archfiend has none).
    expect(r.facets.archetype).toEqual([{ value: 'Frog', count: 2, selected: true }]);
  });

  it('lists a selected value even when nothing matches it', () => {
    const r = run(view({ filters: { attribute: ['LIGHT'] } }));
    expect(r.matching).toBe(0);
    expect(r.facets.attribute).toContainEqual({ value: 'LIGHT', count: 0, selected: true });
  });

  it('sorts by stats with non-monsters last', () => {
    expect(run(view({ sort: 'atk' })).items.map((c) => c.id)).toEqual([3, 1, 2, 4, 5]);
    expect(run(view({ sort: 'def' })).items.map((c) => c.id)).toEqual([2, 3, 1, 4, 5]);
    expect(run(view({ sort: 'name' })).items.map((c) => c.name)[0]).toBe('Archfiend');
  });

  it('pages and clamps the page', () => {
    const many = Array.from({ length: PAGE_SIZE + 5 }, (_, i) => ({ ...base, id: i + 1, name: `C${i}` }));
    const p2 = run(view({ page: 2 }), many);
    expect(p2).toMatchObject({ page: 2, pageCount: 2, matching: PAGE_SIZE + 5 });
    expect(p2.items).toHaveLength(5);
    expect(run(view({ page: 9 }), many).page).toBe(2);
  });
});

describe('parseView / writeView', () => {
  it('round-trips and drops invalid values', () => {
    const v = parseView(new URLSearchParams('kind=Spell&kind=Nope&attr=WATER&attr=water&race=Aqua&arch=Frog&sort=atk&page=3'));
    expect(v).toEqual({ filters: { kind: ['Spell'], attribute: ['WATER'], race: ['Aqua'], archetype: ['Frog'] }, sort: 'atk', page: 3 });
    const url = writeView(new URL('https://x/search?ast=abc&page=7'), v);
    expect(url.searchParams.get('ast')).toBe('abc');
    expect(parseView(url.searchParams)).toEqual(v);
  });

  it('defaults bad sort and page, and omits defaults when writing', () => {
    expect(parseView(new URLSearchParams('sort=bogus&page=-2'))).toEqual(view());
    expect(writeView(new URL('https://x/search?ast=a&sort=atk&page=2'), view()).search).toBe('?ast=a');
  });
});
