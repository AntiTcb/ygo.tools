export type MonsterProps = {
  atk: number;
  def: number;
  position: 'ATK' | 'DEF';
  hasPiercing: boolean;
};

export class BattleModifiers {
  // 01
  inflictsDoubleBattleDamage: boolean = $state(false);
  // 02
  battleDamageIsTakenByBothPlayers: boolean = $state(false);
  // 03
  yourOpponentTakesYourBattleDamage: boolean = $state(false);
  // 03.5
  battleDamageIsAlsoInflictedToYourOpponent: boolean = $state(false);
  // 04
  battleDamageIsConvertedToEffectDamage: boolean = $state(false);
  convertedToEffectDamageInflictType: 'deal' | 'take' | 'deal/take' = $state('deal');
  // 05
  damageIsConvertedToHealing: boolean = $state(false);
  healingDamageType: 'battle' | 'effect' | 'any' = $state('battle');
  // 06
  battleDamageBecomesZero: boolean = $state(false);
  battleDamageBecomesZeroInflictType: 'deal' | 'take' | 'deal/take' = $state('deal');
  // 07
  battleDamageIsHalved: boolean = $state(false);
  battleDamageIsHalvedInflictType: 'deal' | 'take' | 'deal/take' = $state('deal');
  // 08
  battleDamageIsDoubled: boolean = $state(false);
  battleDamageIsDoubledInflictType: 'deal' | 'take' | 'deal/take' = $state('deal');
  // 09
  battleDamageBecomesSpecificValue: boolean = $state(false);
  specificValue: number = $state(0);
  specificValueInflictType: 'deal' | 'take' | 'deal/take' = $state('deal');
  // 10
  damageYouTakeIsPreventedIf: boolean = $state(false);
  damagePreventionComparison: '>' | '>=' | '<' | '<=' = $state('>');
  damagePreventionValue: number = $state(0);
  preventedDamageType: 'battle' | 'effect' | 'any' = $state('battle');

  preventionCondition(damage: number): boolean {
    switch (this.damagePreventionComparison) {
      case '>':
        return damage > this.damagePreventionValue;
      case '>=':
        return damage >= this.damagePreventionValue;
      case '<':
        return damage < this.damagePreventionValue;
      case '<=':
        return damage <= this.damagePreventionValue;
      default:
        return false;
    }
  }
}

export type PlayerBattleResult = {
  battleDamage: number;
  effectDamage: number;
  lifeGained: number;
  redirectedDamage: number;
  redirectedEffectDamage: number;
};

export type BattleResult = {
  playerA: PlayerBattleResult;
  playerB: PlayerBattleResult;
};

export class DamageCalculator {
  attackingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
  defendingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
  playerAModifiers = $state(new BattleModifiers());
  playerBModifiers = $state(new BattleModifiers());
  battleResult = $derived.by(() => this.calculateBattleDamage());

  static fromJson(json: {
    attackingMonster: MonsterProps;
    defendingMonster: MonsterProps;
    playerAModifiers: BattleModifiers;
    playerBModifiers: BattleModifiers;
  }) {
    const calc = new DamageCalculator();
    calc.attackingMonster = json.attackingMonster;
    calc.defendingMonster = json.defendingMonster;
    calc.playerAModifiers = json.playerAModifiers;
    calc.playerBModifiers = json.playerBModifiers;
    return calc;
  }

  calculateBattleDamage(): BattleResult {
    const result = {
      playerA: {
        battleDamage: 0,
        effectDamage: 0,
        lifeGained: 0,
        redirectedDamage: 0,
        redirectedEffectDamage: 0,
      } satisfies PlayerBattleResult,
      playerB: {
        battleDamage: 0,
        effectDamage: 0,
        lifeGained: 0,
        redirectedDamage: 0,
        redirectedEffectDamage: 0,
      } satisfies PlayerBattleResult,
    } satisfies BattleResult;

    // determine initial battle damage
    const attackingBattleValue = this.attackingMonster.position === 'ATK' ? this.attackingMonster.atk : this.attackingMonster.def;
    const defendingBattleValue = this.defendingMonster.position === 'ATK' ? this.defendingMonster.atk : this.defendingMonster.def;
    const isPiercingAttack = this.attackingMonster.hasPiercing && this.defendingMonster.position === 'DEF';
    const damageAmount = attackingBattleValue - defendingBattleValue;

    let aBattleDamage = 0,
      bBattleDamage = 0,
      aRedirectedDamage = 0,
      aRedirectedEffectDamage = 0,
      bRedirectedDamage = 0,
      bRedirectedEffectDamage = 0,
      aEffectDamage = 0,
      bEffectDamage = 0,
      aLifeGained = 0,
      bLifeGained = 0;

    if (damageAmount < 0) {
      aBattleDamage = Math.abs(damageAmount);
    } else {
      bBattleDamage = isPiercingAttack
        ? damageAmount
        : this.attackingMonster.position === 'ATK' && this.defendingMonster.position === 'ATK'
          ? damageAmount
          : 0;
    }

    // 01: Inflicts double battle damage
    if (this.playerAModifiers.inflictsDoubleBattleDamage) {
      bBattleDamage *= 2;
    } else if (this.playerBModifiers.inflictsDoubleBattleDamage) {
      aBattleDamage *= 2;
    }

    // 02: Battle damage is taken by both players
    if (this.playerAModifiers.battleDamageIsTakenByBothPlayers || this.playerBModifiers.battleDamageIsTakenByBothPlayers) {
      if (aBattleDamage > 0) {
        bBattleDamage = aBattleDamage;
      } else if (bBattleDamage > 0) {
        aBattleDamage = bBattleDamage;
      }
    }

    // 03: Your opponent takes the battle damage instead
    if (this.playerAModifiers.yourOpponentTakesYourBattleDamage) {
      bRedirectedDamage = aBattleDamage;
      aBattleDamage = 0;
    }
    if (this.playerBModifiers.yourOpponentTakesYourBattleDamage) {
      aRedirectedDamage = bBattleDamage;
      bBattleDamage = 0;
    }
    // 03.5: Battle damage you take is also inflicted to your opponent
    if (this.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent) {
      bRedirectedDamage += aBattleDamage;
    }
    if (this.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent) {
      aRedirectedDamage += bBattleDamage;
    }

    // 04: Battle damage is treated as effect damage.
    if (
      (this.playerAModifiers.battleDamageIsConvertedToEffectDamage &&
        ['deal', 'deal/take'].includes(this.playerAModifiers.convertedToEffectDamageInflictType)) ||
      (this.playerBModifiers.battleDamageIsConvertedToEffectDamage &&
        ['take', 'deal/take'].includes(this.playerBModifiers.convertedToEffectDamageInflictType))
    ) {
      bEffectDamage = bBattleDamage;
      bBattleDamage = 0;
      if (['take', 'deal/take'].includes(this.playerBModifiers.convertedToEffectDamageInflictType) && bRedirectedDamage > 0) {
        bRedirectedEffectDamage = bRedirectedDamage;
        bRedirectedDamage = 0;
      }
    }

    if (
      (this.playerAModifiers.battleDamageIsConvertedToEffectDamage &&
        ['take', 'deal/take'].includes(this.playerAModifiers.convertedToEffectDamageInflictType)) ||
      (this.playerBModifiers.battleDamageIsConvertedToEffectDamage &&
        ['deal', 'deal/take'].includes(this.playerBModifiers.convertedToEffectDamageInflictType))
    ) {
      aEffectDamage = aBattleDamage;
      aBattleDamage = 0;
      if (['take', 'deal/take'].includes(this.playerAModifiers.convertedToEffectDamageInflictType) && aRedirectedDamage > 0) {
        aRedirectedEffectDamage = aRedirectedDamage;
        aRedirectedDamage = 0;
      }
    }
    // 05:A The player gains Life Points instead of taking battle damage.
    if (this.playerAModifiers.damageIsConvertedToHealing) {
      switch (this.playerAModifiers.healingDamageType) {
        case 'battle':
          aLifeGained = aBattleDamage;
          aBattleDamage = 0;
          break;
        case 'effect':
          aLifeGained = aEffectDamage;
          aEffectDamage = 0;
          break;
        case 'any':
          aLifeGained = aBattleDamage + aEffectDamage;
          aBattleDamage = 0;
          aEffectDamage = 0;
          break;
      }
    }

    // 05:B The player gains Life Points instead of taking battle damage.
    if (this.playerBModifiers.damageIsConvertedToHealing) {
      switch (this.playerBModifiers.healingDamageType) {
        case 'battle':
          bLifeGained = bBattleDamage;
          bBattleDamage = 0;
          break;
        case 'effect':
          bLifeGained = bEffectDamage;
          bEffectDamage = 0;
          break;
        case 'any':
          bLifeGained = bBattleDamage + bEffectDamage;
          bBattleDamage = 0;
          bEffectDamage = 0;
          break;
      }
    }

    // 06.A: Battle damage becomes 0.
    if (
      (this.playerBModifiers.battleDamageBecomesZero && ['deal', 'deal/take'].includes(this.playerBModifiers.battleDamageBecomesZeroInflictType)) ||
      (this.playerAModifiers.battleDamageBecomesZero && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageBecomesZeroInflictType))
    ) {
      aBattleDamage = 0;
      aRedirectedDamage =
        this.playerAModifiers.battleDamageBecomesZero && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageBecomesZeroInflictType)
          ? 0
          : aRedirectedDamage;
    } else if (aBattleDamage > 0 || aRedirectedDamage > 0) {
      // 07.A: Battle damage is halved.
      if (
        (this.playerBModifiers.battleDamageIsHalved && ['deal', 'deal/take'].includes(this.playerBModifiers.battleDamageIsHalvedInflictType)) ||
        (this.playerAModifiers.battleDamageIsHalved && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageIsHalvedInflictType))
      ) {
        aBattleDamage /= 2;
        aRedirectedDamage =
          this.playerAModifiers.battleDamageIsHalved && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageIsHalvedInflictType)
            ? aRedirectedDamage / 2
            : aRedirectedDamage;
      }
      // 08.A: Battle damage is doubled.
      if (
        (this.playerBModifiers.battleDamageIsDoubled && ['deal', 'deal/take'].includes(this.playerBModifiers.battleDamageIsDoubledInflictType)) ||
        (this.playerAModifiers.battleDamageIsDoubled && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageIsDoubledInflictType))
      ) {
        aBattleDamage *= 2;
        aRedirectedDamage =
          this.playerAModifiers.battleDamageIsDoubled && ['take', 'deal/take'].includes(this.playerAModifiers.battleDamageIsDoubledInflictType)
            ? aRedirectedDamage * 2
            : aRedirectedDamage;
      }
      // 09.A: Battle damage becomes X (X being a predetermined value > 0).
      if (
        (this.playerBModifiers.battleDamageBecomesSpecificValue &&
          this.playerBModifiers.specificValueInflictType === 'deal' &&
          !this.playerAModifiers.yourOpponentTakesYourBattleDamage) ||
        (this.playerAModifiers.battleDamageBecomesSpecificValue && this.playerAModifiers.specificValueInflictType === 'take')
      ) {
        const specificValue = this.playerBModifiers.specificValue ? this.playerBModifiers.specificValue : this.playerAModifiers.specificValue;
        aBattleDamage = aBattleDamage > 0 ? specificValue : aBattleDamage;
        aRedirectedDamage =
          aRedirectedDamage > 0 &&
          this.playerAModifiers.battleDamageBecomesSpecificValue &&
          ['take', 'deal/take'].includes(this.playerAModifiers.specificValueInflictType)
            ? specificValue
            : aRedirectedDamage;
      }
    }

    // 10: You do not take damage if it is more or less than X.
    if (
      this.playerAModifiers.damageYouTakeIsPreventedIf &&
      this.playerAModifiers.preventionCondition(aBattleDamage) &&
      ['battle', 'any'].includes(this.playerAModifiers.preventedDamageType)
    ) {
      aBattleDamage = 0;
    }
    if (
      this.playerAModifiers.damageYouTakeIsPreventedIf &&
      this.playerAModifiers.preventionCondition(aRedirectedDamage) &&
      ['battle', 'any'].includes(this.playerAModifiers.preventedDamageType)
    ) {
      aRedirectedDamage = 0;
    }
    if (
      this.playerAModifiers.damageYouTakeIsPreventedIf &&
      this.playerAModifiers.preventionCondition(aEffectDamage) &&
      ['effect', 'any'].includes(this.playerAModifiers.preventedDamageType)
    ) {
      aEffectDamage = 0;
    }

    // 06.B: Battle damage becomes 0.
    if (
      (this.playerBModifiers.battleDamageBecomesZero && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageBecomesZeroInflictType)) ||
      (this.playerAModifiers.battleDamageBecomesZero && ['deal', 'deal/take'].includes(this.playerAModifiers.battleDamageBecomesZeroInflictType))
    ) {
      bBattleDamage = 0;
      bRedirectedDamage =
        this.playerBModifiers.battleDamageBecomesZero && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageBecomesZeroInflictType)
          ? 0
          : bRedirectedDamage;
    } else if (bBattleDamage > 0 || bRedirectedDamage > 0) {
      // 07.B: Battle damage is halved.
      if (
        (this.playerBModifiers.battleDamageIsHalved && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageIsHalvedInflictType)) ||
        (this.playerAModifiers.battleDamageIsHalved && ['deal', 'deal/take'].includes(this.playerAModifiers.battleDamageIsHalvedInflictType))
      ) {
        bBattleDamage /= 2;
        bRedirectedDamage =
          this.playerBModifiers.battleDamageIsHalved && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageIsHalvedInflictType)
            ? bRedirectedDamage / 2
            : bRedirectedDamage;
      }
      // 08.B: Battle damage is doubled.
      if (
        (this.playerBModifiers.battleDamageIsDoubled && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageIsDoubledInflictType)) ||
        (this.playerAModifiers.battleDamageIsDoubled && ['deal', 'deal/take'].includes(this.playerAModifiers.battleDamageIsDoubledInflictType))
      ) {
        bBattleDamage *= 2;
        bRedirectedDamage =
          this.playerBModifiers.battleDamageIsDoubled && ['take', 'deal/take'].includes(this.playerBModifiers.battleDamageIsDoubledInflictType)
            ? bRedirectedDamage * 2
            : bRedirectedDamage;
      }
      // 09.B: Battle damage becomes X (X being a predetermined value).
      if (
        (this.playerAModifiers.battleDamageBecomesSpecificValue &&
          this.playerAModifiers.specificValueInflictType === 'deal' &&
          !this.playerBModifiers.yourOpponentTakesYourBattleDamage) ||
        (this.playerBModifiers.battleDamageBecomesSpecificValue && this.playerBModifiers.specificValueInflictType === 'take')
      ) {
        const specificValue = this.playerAModifiers.battleDamageBecomesSpecificValue
          ? this.playerAModifiers.specificValue
          : this.playerBModifiers.specificValue;
        bBattleDamage = bBattleDamage > 0 ? specificValue : bBattleDamage;
        bRedirectedDamage =
          bRedirectedDamage > 0 &&
          this.playerBModifiers.battleDamageBecomesSpecificValue &&
          ['take', 'deal/take'].includes(this.playerBModifiers.specificValueInflictType)
            ? specificValue
            : bRedirectedDamage;
      }
    }

    // 10: You do not take damage if it is more or less than X.
    if (
      this.playerBModifiers.damageYouTakeIsPreventedIf &&
      this.playerBModifiers.preventionCondition(bBattleDamage) &&
      ['battle', 'any'].includes(this.playerBModifiers.preventedDamageType)
    ) {
      bBattleDamage = 0;
    }
    if (
      this.playerBModifiers.damageYouTakeIsPreventedIf &&
      this.playerBModifiers.preventionCondition(bRedirectedDamage) &&
      ['battle', 'any'].includes(this.playerBModifiers.preventedDamageType)
    ) {
      bRedirectedDamage = 0;
    }
    if (
      this.playerBModifiers.damageYouTakeIsPreventedIf &&
      this.playerBModifiers.preventionCondition(bEffectDamage) &&
      ['effect', 'any'].includes(this.playerBModifiers.preventedDamageType)
    ) {
      bEffectDamage = 0;
    }

    result.playerA.battleDamage = aBattleDamage;
    result.playerA.effectDamage = aEffectDamage;
    result.playerA.lifeGained = aLifeGained;
    result.playerA.redirectedDamage = aRedirectedDamage;
    result.playerB.battleDamage = bBattleDamage;
    result.playerB.effectDamage = bEffectDamage;
    result.playerB.lifeGained = bLifeGained;
    result.playerB.redirectedDamage = bRedirectedDamage;
    result.playerA.redirectedEffectDamage = aRedirectedEffectDamage;
    result.playerB.redirectedEffectDamage = bRedirectedEffectDamage;

    return result;
  }
}

export const createDamageCalculator = () => new DamageCalculator();
