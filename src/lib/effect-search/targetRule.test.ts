import { describe, expect, it } from 'vitest';
import { evalRuleNode, type CardFilterRow } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow } from '../db/cardFilterRule';
import { resolveVirtualRuleTree } from '../db/cardFilterResolve';
import { describeTarget, targetToRule } from './targetRule';
import type { Target } from './tagSchema';

/** Subset of `neuron_complex_frame_types` (id → subtypes). */
const complexRows: ComplexFrameTypeRow[] = [
  { id: 1, subtype_1: 1, subtype_2: null, subtype_3: null }, // Effect
  { id: 13, subtype_1: 11, subtype_2: null, subtype_3: null }, // Spell
  { id: 14, subtype_1: 12, subtype_2: null, subtype_3: null }, // Trap
  { id: 16, subtype_1: 8, subtype_2: 1, subtype_3: null }, // Tuner／Effect
  { id: 23, subtype_1: 10, subtype_2: 1, subtype_3: null }, // Xyz／Effect
  { id: 43, subtype_1: 17, subtype_2: 1, subtype_3: null }, // Link／Effect
];

const card = (partial: Partial<CardFilterRow> & Pick<CardFilterRow, 'id'>): CardFilterRow => ({
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
  ...partial,
});

const toadally = card({ id: 12642, level: 2, atk: 2200, def: 0, attribute_id: 3, species_id: 14, frame_type_id: 23, effect_id: 0 });
const treeborn = card({ id: 6000, level: 2, atk: 100, def: 100, attribute_id: 3, species_id: 14, frame_type_id: 1, archetypes: ['Frog'] });
const tunerFish = card({ id: 6001, level: 4, atk: 1500, def: 1000, attribute_id: 3, species_id: 8, frame_type_id: 16 });
const linkMon = card({ id: 6002, link_rating: 2, atk: 1600, attribute_id: 3, species_id: 14, frame_type_id: 43 });
const questionAtk = card({ id: 6003, level: 4, atk: -1, def: 0, attribute_id: 3, species_id: 14, frame_type_id: 1 });
// Neuron stores Spells/Traps with level 0, ATK/DEF 0 and attribute 8/9.
const quickPlay = card({ id: 6004, frame_type_id: 13, effect_id: 5, level: 0, atk: 0, def: 0, attribute_id: 8 });
const contTrap = card({ id: 6005, frame_type_id: 14, effect_id: 4, level: 0, atk: 0, def: 0, attribute_id: 9 });

const names: Record<string, number> = { 'Toadally Awesome': 12642, 'Treeborn Frog': 6000 };
const resolve = (n: string) => names[n];

const matches = (target: Target, row: CardFilterRow) => {
  const { rule } = targetToRule(target, resolve);
  return evalRuleNode(row, resolveVirtualRuleTree(rule, complexRows));
};

describe('targetToRule', () => {
  it('matches a Rank 2 WATER Xyz target against Toadally Awesome only', () => {
    const t: Target = { attributes: ['WATER'], monster_kinds: ['xyz'], rank: { op: 'lte', value: 2 } };
    expect(matches(t, toadally)).toBe(true);
    expect(matches(t, treeborn)).toBe(false);
  });

  it('treats Level as excluding Xyz monsters (Neuron stores Rank in the level column)', () => {
    const t: Target = { level: { op: 'lte', value: 2 } };
    expect(matches(t, treeborn)).toBe(true);
    expect(matches(t, toadally)).toBe(false);
    expect(matches(t, linkMon)).toBe(false);
  });

  it('handles races, archetypes and monster kind exclusions', () => {
    expect(matches({ races: ['Aqua', 'Fish'], exclude_monster_kinds: ['tuner'] }, tunerFish)).toBe(false);
    expect(matches({ races: ['Aqua', 'Fish'], exclude_monster_kinds: ['tuner'] }, treeborn)).toBe(true);
    expect(matches({ archetypes: ['Frog'] }, treeborn)).toBe(true);
    expect(matches({ archetypes: ['Frog'] }, toadally)).toBe(false);
  });

  it('does not let Spells/Traps (stored as level 0, ATK/DEF 0) satisfy stat constraints', () => {
    expect(matches({ level: { op: 'lte', value: 4 } }, quickPlay)).toBe(false);
    expect(matches({ atk: { op: 'lte', value: 1500 } }, contTrap)).toBe(false);
    expect(matches({ def: { op: 'eq', value: 0 } }, contTrap)).toBe(false);
  });

  it('does not let "?" ATK satisfy an upper bound', () => {
    const t: Target = { atk: { op: 'lte', value: 1500 } };
    expect(matches(t, tunerFish)).toBe(true);
    expect(matches(t, questionAtk)).toBe(false);
  });

  it('resolves names and reports unknown ones', () => {
    expect(matches({ names: ['Toadally Awesome'] }, toadally)).toBe(true);
    expect(matches({ names: ['Toadally Awesome'] }, treeborn)).toBe(false);
    const { unresolvedNames } = targetToRule({ names: ['Toadally Awesome', 'No Such Card'] }, resolve);
    expect(unresolvedNames).toEqual(['No Such Card']);
    expect(matches({ names: ['No Such Card'] }, toadally)).toBe(false);
    expect(matches({ attributes: ['WATER'], exclude_names: ['Toadally Awesome'] }, toadally)).toBe(false);
  });

  it('handles spell/trap subtypes and any_of', () => {
    expect(matches({ spell_trap_types: ['quick_play'] }, quickPlay)).toBe(true);
    expect(matches({ spell_trap_types: ['quick_play'] }, contTrap)).toBe(false);
    expect(matches({ card_types: ['trap'], spell_trap_types: ['continuous'] }, contTrap)).toBe(true);
    const frogOrRank2: Target = { any_of: [{ archetypes: ['Frog'] }, { rank: { op: 'eq', value: 2 } }] };
    expect(matches(frogOrRank2, treeborn)).toBe(true);
    expect(matches(frogOrRank2, toadally)).toBe(true);
    expect(matches(frogOrRank2, tunerFish)).toBe(false);
  });

  it('matches everything for an empty target', () => {
    expect(matches({}, contTrap)).toBe(true);
  });
});

describe('describeTarget', () => {
  it('renders readable targets', () => {
    expect(describeTarget(null)).toBe('any card');
    expect(describeTarget({ attributes: ['WATER'], monster_kinds: ['xyz'], rank: { op: 'lte', value: 2 }, card_types: ['monster'] })).toBe(
      'Rank 2 or lower WATER xyz monster',
    );
    expect(describeTarget({ archetypes: ['Frog'], card_types: ['monster'] })).toBe('"Frog" monster');
  });
});
