import { describe, expect, it } from 'vitest';
import {
  battleModifiersParamsSchema,
  damagecalcSearchParamsSchema,
  monsterParamsSchema,
} from './damagecalcSearchParams.schema';

describe('damagecalcSearchParamsSchema', () => {
  it('fills defaults for an empty object', () => {
    const parsed = damagecalcSearchParamsSchema.parse({});
    expect(parsed.attackingMonster).toEqual({
      atk: 0,
      def: 0,
      position: 'ATK',
      hasPiercing: false,
    });
    expect(parsed.defendingMonster).toEqual({
      atk: 0,
      def: 0,
      position: 'ATK',
      hasPiercing: false,
    });
    expect(parsed.playerAModifiers).toEqual(battleModifiersParamsSchema.parse({}));
    expect(parsed.playerBModifiers).toEqual(battleModifiersParamsSchema.parse({}));
    expect(parsed.showExamples).toBe(false);
  });

  it('accepts populated calculator state', () => {
    const parsed = damagecalcSearchParamsSchema.parse({
      attackingMonster: { atk: 3000, def: 2500, position: 'ATK', hasPiercing: true },
      defendingMonster: { atk: 0, def: 2000, position: 'DEF', hasPiercing: false },
      playerAModifiers: { inflictsDoubleBattleDamage: true },
      playerBModifiers: { battleDamageIsHalved: true, battleDamageIsHalvedInflictType: 'take' },
      showExamples: true,
    });
    expect(parsed.attackingMonster.atk).toBe(3000);
    expect(parsed.attackingMonster.hasPiercing).toBe(true);
    expect(parsed.defendingMonster.position).toBe('DEF');
    expect(parsed.playerAModifiers.inflictsDoubleBattleDamage).toBe(true);
    expect(parsed.playerBModifiers.battleDamageIsHalved).toBe(true);
    expect(parsed.playerBModifiers.battleDamageIsHalvedInflictType).toBe('take');
    expect(parsed.showExamples).toBe(true);
  });

  it('rejects invalid monster position', () => {
    expect(() => monsterParamsSchema.parse({ position: 'FACE' })).toThrow();
  });

  it('rejects invalid modifier enum values', () => {
    expect(() =>
      battleModifiersParamsSchema.parse({
        convertedToEffectDamageInflictType: 'neither',
      }),
    ).toThrow();
    expect(() =>
      battleModifiersParamsSchema.parse({
        damagePreventionComparison: '==',
      }),
    ).toThrow();
  });
});
