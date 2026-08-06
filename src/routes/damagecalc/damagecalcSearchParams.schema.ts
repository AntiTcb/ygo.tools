import { BattleModifiers, type MonsterProps } from '$lib/damageCalc.svelte';
import { z } from 'zod';

const inflictTypeSchema = z.enum(['deal', 'take', 'deal/take']);
const damageTypeSchema = z.enum(['battle', 'effect', 'any']);
const comparisonSchema = z.enum(['>', '>=', '<', '<=']);

export const monsterParamsSchema = z.object({
  atk: z.number().default(0),
  def: z.number().default(0),
  position: z.enum(['ATK', 'DEF']).default('ATK'),
  hasPiercing: z.boolean().default(false),
});

export const battleModifiersParamsSchema = z.object({
  inflictsDoubleBattleDamage: z.boolean().default(false),
  battleDamageIsTakenByBothPlayers: z.boolean().default(false),
  yourOpponentTakesYourBattleDamage: z.boolean().default(false),
  battleDamageIsAlsoInflictedToYourOpponent: z.boolean().default(false),
  battleDamageIsConvertedToEffectDamage: z.boolean().default(false),
  convertedToEffectDamageInflictType: inflictTypeSchema.default('deal'),
  damageIsConvertedToHealing: z.boolean().default(false),
  healingDamageType: damageTypeSchema.default('battle'),
  battleDamageBecomesZero: z.boolean().default(false),
  battleDamageBecomesZeroInflictType: inflictTypeSchema.default('deal'),
  battleDamageIsHalved: z.boolean().default(false),
  battleDamageIsHalvedInflictType: inflictTypeSchema.default('deal'),
  battleDamageIsDoubled: z.boolean().default(false),
  battleDamageIsDoubledInflictType: inflictTypeSchema.default('deal'),
  battleDamageBecomesSpecificValue: z.boolean().default(false),
  specificValue: z.number().default(0),
  specificValueInflictType: inflictTypeSchema.default('deal'),
  damageYouTakeIsPreventedIf: z.boolean().default(false),
  damagePreventionComparison: comparisonSchema.default('>'),
  damagePreventionValue: z.number().default(0),
  preventedDamageType: damageTypeSchema.default('battle'),
});

/**
 * URL-backed calculator state for `/damagecalc`. Consumed by `useSearchParams`
 * in `+page.svelte` so battles are shareable via a single compressed URL.
 */
export const damagecalcSearchParamsSchema = z.object({
  attackingMonster: monsterParamsSchema.default({
    atk: 0,
    def: 0,
    position: 'ATK',
    hasPiercing: false,
  }),
  defendingMonster: monsterParamsSchema.default({
    atk: 0,
    def: 0,
    position: 'ATK',
    hasPiercing: false,
  }),
  playerAModifiers: battleModifiersParamsSchema.default(battleModifiersParamsSchema.parse({})),
  playerBModifiers: battleModifiersParamsSchema.default(battleModifiersParamsSchema.parse({})),
  showExamples: z.boolean().default(false),
});

export type DamagecalcSearchParams = z.infer<typeof damagecalcSearchParamsSchema>;
export type BattleModifiersParams = z.infer<typeof battleModifiersParamsSchema>;

/** Plain-data snapshot — avoids structuredClone on Svelte `$state` proxies. */
export const cloneMonster = (m: MonsterProps): MonsterProps => ({
  atk: m.atk,
  def: m.def,
  position: m.position,
  hasPiercing: m.hasPiercing,
});

export const cloneModifiers = (mods: BattleModifiers | BattleModifiersParams): BattleModifiersParams =>
  battleModifiersParamsSchema.parse(mods instanceof BattleModifiers ? mods.getProps() : mods);

export const applyModifiers = (target: BattleModifiers, props: BattleModifiersParams) => {
  target.inflictsDoubleBattleDamage = props.inflictsDoubleBattleDamage;
  target.battleDamageIsTakenByBothPlayers = props.battleDamageIsTakenByBothPlayers;
  target.yourOpponentTakesYourBattleDamage = props.yourOpponentTakesYourBattleDamage;
  target.battleDamageIsAlsoInflictedToYourOpponent = props.battleDamageIsAlsoInflictedToYourOpponent;
  target.battleDamageIsConvertedToEffectDamage = props.battleDamageIsConvertedToEffectDamage;
  target.convertedToEffectDamageInflictType = props.convertedToEffectDamageInflictType;
  target.damageIsConvertedToHealing = props.damageIsConvertedToHealing;
  target.healingDamageType = props.healingDamageType;
  target.battleDamageBecomesZero = props.battleDamageBecomesZero;
  target.battleDamageBecomesZeroInflictType = props.battleDamageBecomesZeroInflictType;
  target.battleDamageIsHalved = props.battleDamageIsHalved;
  target.battleDamageIsHalvedInflictType = props.battleDamageIsHalvedInflictType;
  target.battleDamageIsDoubled = props.battleDamageIsDoubled;
  target.battleDamageIsDoubledInflictType = props.battleDamageIsDoubledInflictType;
  target.battleDamageBecomesSpecificValue = props.battleDamageBecomesSpecificValue;
  target.specificValue = props.specificValue;
  target.specificValueInflictType = props.specificValueInflictType;
  target.damageYouTakeIsPreventedIf = props.damageYouTakeIsPreventedIf;
  target.damagePreventionComparison = props.damagePreventionComparison;
  target.damagePreventionValue = props.damagePreventionValue;
  target.preventedDamageType = props.preventedDamageType;
};

export const snapshotDamagecalcParams = (input: {
  attackingMonster: MonsterProps;
  defendingMonster: MonsterProps;
  playerAModifiers: BattleModifiers;
  playerBModifiers: BattleModifiers;
  showExamples: boolean;
}): DamagecalcSearchParams => ({
  attackingMonster: cloneMonster(input.attackingMonster),
  defendingMonster: cloneMonster(input.defendingMonster),
  playerAModifiers: cloneModifiers(input.playerAModifiers),
  playerBModifiers: cloneModifiers(input.playerBModifiers),
  showExamples: input.showExamples,
});
