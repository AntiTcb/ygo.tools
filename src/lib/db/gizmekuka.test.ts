import { describe, expect, it } from 'vitest';
import { NEURON_ATK_DEF_QUESTION_MARK, SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from './cardFilterRule';
import {
  findGizmekUkaSummons,
  findGizmekUkaTargets,
  isAtkEqualToOwnDef,
  isLegalGizmekUkaMonster,
  isLegalGizmekUkaSummon,
  sharesAttribute,
  type GizmekUkaCard,
} from './gizmekuka';

const card = (partial: Partial<GizmekUkaCard> & Pick<GizmekUkaCard, 'id' | 'name'>): GizmekUkaCard => ({
  attribute_id: null,
  atk: null,
  def: null,
  frame_type_id: 1,
  ...partial,
});

const darkMagician = card({
  id: 1,
  name: 'Dark Magician',
  attribute_id: 2,
  atk: 2500,
  def: 2100,
});

const spiritReaper = card({
  id: 2,
  name: 'Spirit Reaper',
  attribute_id: 2,
  atk: 300,
  def: 300,
});

const gizmekUka = card({
  id: 3,
  name: 'Gizmek Uka, the Festive Fox of Fecundity',
  attribute_id: 1,
  atk: 1000,
  def: 1000,
});

const accesscode = card({
  id: 4,
  name: 'Accesscode Talker',
  attribute_id: 2,
  atk: 2300,
  def: null,
  frame_type_id: 2,
});

const darkExtraAtkDef = card({
  id: 5,
  name: 'Dark Extra ATK=DEF',
  attribute_id: 2,
  atk: 2000,
  def: 2000,
  frame_type_id: 2,
});

const blueEyes = card({
  id: 6,
  name: 'Blue-Eyes White Dragon',
  attribute_id: 1,
  atk: 3000,
  def: 2500,
});

const sheepToken = card({
  id: 7,
  name: 'Sheep Token',
  attribute_id: 2,
  atk: 0,
  def: 0,
});

describe('isAtkEqualToOwnDef', () => {
  it('requires a known numeric ATK that equals DEF', () => {
    expect(isAtkEqualToOwnDef({ atk: 300, def: 300 })).toBe(true);
    expect(isAtkEqualToOwnDef({ atk: 0, def: 0 })).toBe(true);
    expect(isAtkEqualToOwnDef({ atk: 2500, def: 2100 })).toBe(false);
  });

  it('rejects null and question-mark stats', () => {
    expect(isAtkEqualToOwnDef({ atk: 2300, def: null })).toBe(false);
    expect(isAtkEqualToOwnDef({ atk: null, def: null })).toBe(false);
    expect(isAtkEqualToOwnDef({ atk: NEURON_ATK_DEF_QUESTION_MARK, def: NEURON_ATK_DEF_QUESTION_MARK })).toBe(false);
    expect(isAtkEqualToOwnDef({ atk: NEURON_ATK_DEF_QUESTION_MARK, def: 0 })).toBe(false);
  });
});

describe('isLegalGizmekUkaMonster / isLegalGizmekUkaSummon', () => {
  it('keeps Extra Deck monsters as legal targets but not as summons', () => {
    expect(isLegalGizmekUkaMonster(accesscode)).toBe(true);
    expect(isLegalGizmekUkaSummon(accesscode)).toBe(false);
    expect(isLegalGizmekUkaMonster(darkExtraAtkDef)).toBe(true);
    expect(isLegalGizmekUkaSummon(darkExtraAtkDef)).toBe(false);
  });

  it('rejects spells, traps, and tokens as either role', () => {
    expect(isLegalGizmekUkaMonster({ name: 'Raigeki', frame_type_id: SPELL_FRAME_TYPE_ID })).toBe(false);
    expect(isLegalGizmekUkaMonster({ name: 'Infinite Impermanence', frame_type_id: TRAP_FRAME_TYPE_ID })).toBe(false);
    expect(isLegalGizmekUkaMonster(sheepToken)).toBe(false);
    expect(isLegalGizmekUkaSummon(sheepToken)).toBe(false);
  });

  it('allows Main Deck ATK=DEF monsters as summons', () => {
    expect(isLegalGizmekUkaSummon(spiritReaper)).toBe(true);
    expect(isLegalGizmekUkaSummon(gizmekUka)).toBe(true);
    expect(isLegalGizmekUkaSummon(darkMagician)).toBe(false);
  });
});

describe('sharesAttribute', () => {
  it('matches the same attribute and never treats null as a match', () => {
    expect(sharesAttribute(darkMagician, spiritReaper)).toBe(true);
    expect(sharesAttribute(darkMagician, gizmekUka)).toBe(false);
    expect(sharesAttribute({ attribute_id: null }, { attribute_id: null })).toBe(false);
  });
});

describe('findGizmekUkaSummons', () => {
  const pool = [darkMagician, spiritReaper, gizmekUka, accesscode, darkExtraAtkDef, blueEyes, sheepToken];

  it('returns Main Deck ATK=DEF monsters of the same Attribute, including the selected card when legal', () => {
    const summons = findGizmekUkaSummons(darkMagician, pool);
    expect(summons.map((c) => c.id).sort((a, b) => a - b)).toEqual([2]);
  });

  it('excludes Extra Deck even when ATK equals DEF', () => {
    const summons = findGizmekUkaSummons(darkMagician, pool);
    expect(summons.some((c) => c.id === 5)).toBe(false);
  });

  it('excludes tokens and different Attributes', () => {
    const summons = findGizmekUkaSummons(darkMagician, pool);
    expect(summons.some((c) => c.id === 3 || c.id === 7)).toBe(false);
  });
});

describe('findGizmekUkaTargets', () => {
  const pool = [darkMagician, spiritReaper, gizmekUka, accesscode, darkExtraAtkDef, blueEyes, sheepToken];

  it('returns every same-Attribute monster when the selected card is a legal summon', () => {
    const targets = findGizmekUkaTargets(spiritReaper, pool);
    expect(targets.map((c) => c.id).sort((a, b) => a - b)).toEqual([1, 2, 4, 5]);
  });

  it('includes Extra Deck targets and excludes tokens and other Attributes', () => {
    const targets = findGizmekUkaTargets(spiritReaper, pool);
    expect(targets.some((c) => c.id === 4 || c.id === 5)).toBe(true);
    expect(targets.some((c) => c.id === 3 || c.id === 7)).toBe(false);
  });

  it('returns no targets when the selected card cannot be summoned by Gizmek Uka', () => {
    expect(findGizmekUkaTargets(darkMagician, pool)).toEqual([]);
    expect(findGizmekUkaTargets(accesscode, pool)).toEqual([]);
    expect(findGizmekUkaTargets(darkExtraAtkDef, pool)).toEqual([]);
  });
});
