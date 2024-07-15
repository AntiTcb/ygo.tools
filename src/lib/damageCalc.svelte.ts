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
    battleDamageYouDealIsConvertedToEffectDamage: boolean = $state(false);
    // 05
    damageYouTakeIsConvertedToHealing: boolean = $state(false);
    healingDamageType: 'battle' | 'effect' | 'any' = $state('battle');
    // 06
    battleDamageYouDealBecomesZero: boolean = $state(false);
    // 07
    battleDamageYouDealIsHalved: boolean = $state(false);
    // 08
    battleDamageYouDealIsDoubled: boolean = $state(false);
    // 09
    battleDamageYouDoBecomesSpecificValue: boolean = $state(false);
    specificValue: number = $state(0);
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

export type BattleResult = {
    playerA: {
        battleDamage: number;
        effectDamage: number;
        lifeGained: number;
        redirectedDamage: number;
    };
    playerB: {
        battleDamage: number;
        effectDamage: number;
        lifeGained: number;
        redirectedDamage: number;
    };
};

export class DamageCalculator {
    attackingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    defendingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    playerAModifiers = new BattleModifiers();
    playerBModifiers = new BattleModifiers();
    battleResult = $derived.by(() => this.calculateBattleDamage());

    static fromJson(json: { attackingMonster: MonsterProps; defendingMonster: MonsterProps; playerAModifiers: BattleModifiers; playerBModifiers: BattleModifiers }) {
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
            },
            playerB: {
                battleDamage: 0,
                effectDamage: 0,
                lifeGained: 0,
                redirectedDamage: 0,
            },
        } satisfies BattleResult;
        // determine initial battle damage
        const attackingBattleValue = this.attackingMonster.position === 'ATK' ? this.attackingMonster.atk : this.attackingMonster.def;
        const defendingBattleValue = this.defendingMonster.position === 'ATK' ? this.defendingMonster.atk : this.defendingMonster.def;
        const isPiercingAttack = this.attackingMonster.hasPiercing && this.defendingMonster.position === 'DEF';
        const damageAmount = attackingBattleValue - defendingBattleValue;

        let aBattleDamage = 0,
            bBattleDamage = 0,
            aRedirectedDamage = 0,
            bRedirectedDamage = 0,
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
        if (this.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage) {
            bEffectDamage = bBattleDamage;
            bBattleDamage = 0;
        }
        if (this.playerBModifiers.battleDamageYouDealIsConvertedToEffectDamage) {
            aEffectDamage = aBattleDamage;
            aBattleDamage = 0;
        }
        // 05:A The player gains Life Points instead of taking battle damage.
        if (this.playerAModifiers.damageYouTakeIsConvertedToHealing) {
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
        if (this.playerBModifiers.damageYouTakeIsConvertedToHealing) {
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

        // 06: Battle damage becomes 0.
        if (this.playerBModifiers.battleDamageYouDealBecomesZero) {
            aBattleDamage = 0;
        } else if (aBattleDamage > 0) {
            // 07: Battle damage is halved.
            if (this.playerBModifiers.battleDamageYouDealIsHalved) {
                aBattleDamage /= 2;
            }
            // 08: Battle damage is doubled.
            if (this.playerBModifiers.battleDamageYouDealIsDoubled) {
                aBattleDamage *= 2;
            }
            // 09: Battle damage becomes X (X being a predetermined value > 0).
            if (this.playerBModifiers.battleDamageYouDoBecomesSpecificValue && !this.playerAModifiers.yourOpponentTakesYourBattleDamage) {
                aBattleDamage = this.playerBModifiers.specificValue;
            }
        }

            // 10: You do not take damage if it is more or less than X.
            if (this.playerAModifiers.damageYouTakeIsPreventedIf && this.playerAModifiers.preventionCondition(aBattleDamage) && ['battle', 'any'].includes(this.playerAModifiers.preventedDamageType)) {
                aBattleDamage = 0;
            }
            if (this.playerAModifiers.damageYouTakeIsPreventedIf && this.playerAModifiers.preventionCondition(aRedirectedDamage) && ['battle', 'any'].includes(this.playerAModifiers.preventedDamageType)) {
                aRedirectedDamage = 0;
            }
            if (this.playerAModifiers.damageYouTakeIsPreventedIf && this.playerAModifiers.preventionCondition(aEffectDamage) && ['effect', 'any'].includes(this.playerAModifiers.preventedDamageType)) {
                aEffectDamage = 0;
            }

        // 06: Battle damage becomes 0.
        if (this.playerAModifiers.battleDamageYouDealBecomesZero) {
            bBattleDamage = 0;
        } else if (bBattleDamage > 0) {
            // 07: Battle damage is halved.
            if (this.playerAModifiers.battleDamageYouDealIsHalved) {
                bBattleDamage /= 2;
            }
            // 08: Battle damage is doubled.
            if (this.playerAModifiers.battleDamageYouDealIsDoubled) {
                bBattleDamage *= 2;
            }
            // 09: Battle damage becomes X (X being a predetermined value).
            if (this.playerAModifiers.battleDamageYouDoBecomesSpecificValue  && !this.playerBModifiers.yourOpponentTakesYourBattleDamage) {
                bBattleDamage = this.playerAModifiers.specificValue;
            }
        }

            // 10: You do not take damage if it is more or less than X.
            if (this.playerBModifiers.damageYouTakeIsPreventedIf && this.playerBModifiers.preventionCondition(bBattleDamage) && ['battle', 'any'].includes(this.playerBModifiers.preventedDamageType)) {
                bBattleDamage = 0;
            }
            if (this.playerBModifiers.damageYouTakeIsPreventedIf && this.playerBModifiers.preventionCondition(bRedirectedDamage) && ['battle', 'any'].includes(this.playerBModifiers.preventedDamageType)) {
                bRedirectedDamage = 0;
            }
            if (this.playerBModifiers.damageYouTakeIsPreventedIf && this.playerBModifiers.preventionCondition(bEffectDamage) && ['effect', 'any'].includes(this.playerBModifiers.preventedDamageType)) {
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

        return result;
    }
}

export const createDamageCalculator = () => new DamageCalculator();
