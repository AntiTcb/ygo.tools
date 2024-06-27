export type MonsterProps = {
    atk: number;
    def: number;
    position: 'ATK' | 'DEF';
    hasPiercing: boolean;
};

export type BattleModifiers = {
  inflictsDoubleDamage: boolean;
  damageToBothPlayers: boolean;
  redirectToOpponent: boolean;
  alsoInflictedToOpponent: boolean;
  convertToEffectDamage: boolean;
  convertToHealing: boolean;
  preventDamage: boolean;
  halveDamage: boolean;
  doubleDamage: boolean;
  setToSpecificValue: boolean;
  preventIfConditionMet: boolean;
}

export function createDamageCalculator() {
    const attackingMonster: MonsterProps = $state({ atk: 0, def: 0, position: 'ATK', hasPiercing: false});
    const defendingMonster: MonsterProps = $state({ atk: 0, def: 0, position: 'ATK', hasPiercing: false});
    const battleModifiers : { playerA: BattleModifiers, playerB: BattleModifiers } | undefined = $state();
    const damage = $derived.by(() => calculateBattleDamage(attackingMonster, defendingMonster, battleModifiers));

    return {
      attackingMonster,
      defendingMonster,
      battleModifiers,
      damage,
    }
}

const calculateBattleDamage = (attackingMonster: MonsterProps, defendingMonster: MonsterProps, battleModifiers: {playerA: BattleModifiers, playerB: BattleModifiers} | undefined) => {
  const result = $state({
    attackingPlayer: {
        battleDamage: 0,
        effectDamage: 0,
    },
    defendingPlayer: {
        battleDamage: 0,
        effectDamage: 0,
    }
  });

  const attackingBattleValue = attackingMonster.position === 'ATK' ? attackingMonster.atk : attackingMonster.def;
  const defendingBattleValue = defendingMonster.position === 'ATK' ? defendingMonster.atk : defendingMonster.def;

  if (attackingBattleValue > defendingBattleValue) {
    result.defendingPlayer.battleDamage = defendingMonster.position === 'DEF' && !attackingMonster.hasPiercing ? 0 : attackingBattleValue - defendingBattleValue;
  } else if (attackingBattleValue < defendingBattleValue) {
    result.attackingPlayer.battleDamage = attackingMonster.position === 'DEF' && !defendingMonster.hasPiercing ? 0 : defendingBattleValue - attackingBattleValue;
  }

  return { ...result };
}
