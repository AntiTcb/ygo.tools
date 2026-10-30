import { describe, expect, it } from 'vitest';
import type { CardFilterRow } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow } from '../db/cardFilterRule';
import type { PoolCard } from './db';
import { classify, RuleMatcher, targetSpecificity, type ResolvedTarget } from './searchEngine';
import { targetToRule } from './targetRule';
import type { Target } from './tagSchema';

const complexRows: ComplexFrameTypeRow[] = [
  { id: 1, subtype_1: 1, subtype_2: null, subtype_3: null }, // Effect
  { id: 16, subtype_1: 8, subtype_2: 1, subtype_3: null }, // Tuner／Effect
  { id: 23, subtype_1: 10, subtype_2: 1, subtype_3: null }, // Xyz／Effect
];

const card = (name: string, row: Partial<CardFilterRow> & Pick<CardFilterRow, 'id'>): PoolCard =>
  ({
    name,
    effect_text: null,
    atk: null,
    def: null,
    level: null,
    link_rating: null,
    pend_scale_l: null,
    pend_scale_r: null,
    attribute_id: null,
    species_id: null,
    frame_type_id: null,
    effect_id: null,
    link_arrows: null,
    pendulum_text: null,
    ...row,
  }) as PoolCard;

// WATER is attribute 3, Aqua is species 14.
const toadally = card('Toadally Awesome', {
  id: 12642,
  level: 2,
  atk: 2200,
  def: 0,
  attribute_id: 3,
  species_id: 14,
  frame_type_id: 23,
  effect_id: 0,
});
const tunerFish = card('Tuner Fish', { id: 6001, level: 4, atk: 1500, def: 1000, attribute_id: 3, species_id: 8, frame_type_id: 16 });
const owner = card('Owner', { id: 7000, level: 4, attribute_id: 3, species_id: 14, frame_type_id: 1 });

const rule = (t: Target) => targetToRule(t, () => undefined).rule;

const effect = (t: Target | null, extra: Partial<Parameters<typeof classify>[1]> = {}) => ({
  rule: t ? rule(t) : null,
  specificity: targetSpecificity(t),
  nameRefs: [],
  isSelf: false,
  contextual: false,
  owner,
  ...extra,
});

describe('targetSpecificity', () => {
  it('ignores card types and name exclusions', () => {
    expect(targetSpecificity(null)).toBe(0);
    expect(targetSpecificity({ card_types: ['monster'] })).toBe(0);
    expect(targetSpecificity({ card_types: ['monster'], exclude_names: ['Toadally Awesome'] })).toBe(0);
  });

  it('counts restricting fields', () => {
    expect(targetSpecificity({ attributes: ['WATER'] })).toBe(1);
    expect(targetSpecificity({ attributes: ['WATER'], races: ['Aqua'], rank: { op: 'lte', value: 2 } })).toBe(3);
  });
});

describe('classify', () => {
  const matcher = new RuleMatcher(complexRows);
  const named: ResolvedTarget = { kind: 'card', card: toadally };

  it('ranks an effect naming the card above restriction matches', () => {
    expect(classify(named, effect({ races: ['Aqua'] }, { nameRefs: [12642] }), matcher)).toBe('name');
    expect(classify(named, effect({ attributes: ['WATER'], monster_kinds: ['xyz'] }), matcher)).toBe('property');
    expect(classify(named, effect({ attributes: ['WATER'] }, { contextual: true }), matcher)).toBe('contextual');
  });

  it('treats card-type-only and missing restrictions as unrestricted', () => {
    expect(classify(named, effect(null), matcher)).toBe('unrestricted');
    expect(classify(named, effect({ card_types: ['monster'] }), matcher)).toBe('unrestricted');
  });

  it('rejects effects whose restrictions exclude the card', () => {
    expect(classify(named, effect({ attributes: ['FIRE'] }), matcher)).toBeNull();
    expect(classify(named, effect({ monster_kinds: ['link'] }), matcher)).toBeNull();
  });

  it('only counts "itself" effects on the asked-about card', () => {
    expect(classify(named, effect(null, { isSelf: true, owner: toadally }), matcher)).toBe('self');
    expect(classify(named, effect(null, { isSelf: true }), matcher)).toBeNull();
  });

  it('separates restrictions covering every described card from partial overlaps', () => {
    const water = rule({ attributes: ['WATER'] });
    const want: ResolvedTarget = { kind: 'cards', rule: water, cards: [toadally, tunerFish], key: 'water' };
    expect(classify(want, effect({ attributes: ['WATER'] }), matcher)).toBe('property');
    expect(classify(want, effect({ races: ['Aqua'] }), matcher)).toBe('partial');
    expect(classify(want, effect({ attributes: ['FIRE'] }), matcher)).toBeNull();
    expect(classify(want, effect({ card_types: ['monster'] }), matcher)).toBe('unrestricted');
  });

  it('gives "match" when the query has no target, and nothing for unknown names', () => {
    expect(classify({ kind: 'none' }, effect({ attributes: ['FIRE'] }), matcher)).toBe('match');
    expect(classify({ kind: 'unknown', name: 'Toadaly', suggestions: [] }, effect(null), matcher)).toBeNull();
  });
});
