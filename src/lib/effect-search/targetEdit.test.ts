import { describe, expect, it } from 'vitest';
import { SELF } from './query';
import {
  addValue,
  cleanTarget,
  clearField,
  isValidTarget,
  pickedFrom,
  pickedTarget,
  setNum,
  showsMonsterFields,
  showsSpellTrapFields,
  toggleValue,
} from './targetEdit';

describe('targetEdit', () => {
  it('toggles list values and drops emptied lists', () => {
    const t = toggleValue(null, 'attributes', 'WATER');
    expect(t).toEqual({ attributes: ['WATER'] });
    expect(toggleValue(t, 'attributes', 'DARK')).toEqual({ attributes: ['WATER', 'DARK'] });
    expect(toggleValue(t, 'attributes', 'WATER')).toBeNull();
    expect(toggleValue({ races: ['Aqua'], attributes: ['WATER'] }, 'attributes', 'WATER')).toEqual({ races: ['Aqua'] });
  });

  it('adds trimmed values once', () => {
    const t = addValue(null, 'archetypes', '  Frog ');
    expect(t).toEqual({ archetypes: ['Frog'] });
    expect(addValue(t, 'archetypes', 'Frog')).toBe(t);
    expect(addValue(t, 'archetypes', '   ')).toBe(t);
  });

  it('sets and clears comparisons', () => {
    const t = setNum({ races: ['Aqua'] }, 'atk', { op: 'lte', value: 1000 });
    expect(t).toEqual({ races: ['Aqua'], atk: { op: 'lte', value: 1000 } });
    expect(setNum(t, 'atk', null)).toEqual({ races: ['Aqua'] });
    expect(clearField(t, 'races')).toEqual({ atk: { op: 'lte', value: 1000 } });
  });

  it('cleans to null when empty', () => {
    expect(cleanTarget({ attributes: [] } as never)).toBeNull();
    expect(cleanTarget(null)).toBeNull();
  });

  it('shows fields by card type', () => {
    expect(showsMonsterFields(null)).toBe(true);
    expect(showsMonsterFields({ card_types: ['spell'] })).toBe(false);
    expect(showsSpellTrapFields({ card_types: ['trap', 'monster'] })).toBe(true);
    expect(showsSpellTrapFields(null)).toBe(false);
  });

  it('validates against the schema', () => {
    expect(isValidTarget({ attributes: ['WATER'] })).toBe(true);
    expect(isValidTarget({ attributes: ['water'] } as never)).toBe(false);
    expect(isValidTarget(null)).toBe(true);
  });
});

describe('picked targets', () => {
  it('reads and writes query slots', () => {
    expect(pickedFrom(null)).toEqual({ kind: 'any' });
    expect(pickedFrom(null, true)).toEqual({ kind: 'self' });
    expect(pickedFrom({ card: SELF })).toEqual({ kind: 'self' });
    expect(pickedFrom({ card: 'Toadally Awesome' })).toEqual({ kind: 'card', card: 'Toadally Awesome' });
    expect(pickedFrom({ attributes: ['WATER'] })).toEqual({ kind: 'described', target: { attributes: ['WATER'] } });
    expect(pickedTarget({ kind: 'self' })).toEqual({ card: SELF });
    expect(pickedTarget({ kind: 'described', target: { attributes: [] } as never })).toBeNull();
  });
});
