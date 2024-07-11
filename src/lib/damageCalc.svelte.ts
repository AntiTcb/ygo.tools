export type MonsterProps = {
    atk: number;
    def: number;
    position: 'ATK' | 'DEF';
    hasPiercing: boolean;
};

export class BattleModifiers {
    inflictsDoubleDamage: boolean = $state(false);
    damageToBothPlayers: boolean = $state(false);
    redirectToOpponent: boolean = $state(false);
    alsoInflictedToOpponent: boolean = $state(false);
    convertToEffectDamage: boolean = $state(false);
    convertDamageTakenToHealing: boolean = $state(false);
    cannotDealDamage: boolean = $state(false);
    dealHalfDamage: boolean = $state(false);
    dealDoubleDamage: boolean = $state(false);
    setToSpecificValue: boolean = $state(false);
    specificValue: number = $state(0);
    preventIfConditionMet: boolean = $state(false);
    comparison: '>' | '>=' | '<' | '<=' = $state('>');
    preventionDamageValue: number = $state(0);

    preventionCondition(battleDamage: number): boolean {
        switch (this.comparison) {
          case '>':
            return battleDamage > this.preventionDamageValue;
          case '>=':
            return battleDamage >= this.preventionDamageValue;
          case '<':
            return battleDamage < this.preventionDamageValue;
          case '<=':
            return battleDamage <= this.preventionDamageValue;
          default:
            return false;
        }
    }

    // indexer
    [key: string]: boolean | number | ((battleDamage: number, comparison: '>' | '>=' | '<' | '<=', damageValue: number) => boolean) | string;
}

export class DamageCalculator {
    attackingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    defendingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    playerAModifiers = new BattleModifiers();
    playerBModifiers = new BattleModifiers();
    battleResult = $derived.by(() => this.calculateBattleDamage());

    calculateBattleDamage() {
        const result = {
            playerA: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            playerB: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
        };
        // determine initial battle damage
        const attackingBattleValue = this.attackingMonster.position === 'ATK' ? this.attackingMonster.atk : this.attackingMonster.def;
        const defendingBattleValue = this.defendingMonster.position === 'ATK' ? this.defendingMonster.atk : this.defendingMonster.def;
        const isPiercingAttack = this.attackingMonster.hasPiercing && this.defendingMonster.position === 'DEF';
        const damageAmount = attackingBattleValue - defendingBattleValue;

        let aDamage = 0,
            bDamage = 0,
            aRedirectedDamage = 0,
            bRedirectedDamage = 0,
            aEffectDamage = 0,
            bEffectDamage = 0;

        if (damageAmount < 0) {
            aDamage = Math.abs(damageAmount);
        } else {
            bDamage = isPiercingAttack
                ? damageAmount
                : this.attackingMonster.position === 'ATK' && this.defendingMonster.position === 'ATK'
                  ? damageAmount
                  : 0;
        }

        // 01: Inflicts double battle damage
        if (this.playerAModifiers.inflictsDoubleDamage) {
            bDamage *= 2;
        } else if (this.playerBModifiers.inflictsDoubleDamage) {
            aDamage *= 2;
        }

        // 02: Battle damage is taken by both players
        if (this.playerAModifiers.damageToBothPlayers || this.playerBModifiers.damageToBothPlayers) {
            if (aDamage > 0) {
                bDamage = aDamage;
            } else if (bDamage > 0) {
                aDamage = bDamage;
            }
        }

        // 03: Your opponent takes the battle damage instead
        if (this.playerAModifiers.redirectToOpponent) {
            bRedirectedDamage = aDamage;
            aDamage = 0;
        }
        if (this.playerBModifiers.redirectToOpponent) {
            aRedirectedDamage = bDamage;
            bDamage = 0;
        }
        // 03.5: Battle damage you take is also inflicted to your opponent
        if (this.playerAModifiers.alsoInflictedToOpponent) {
            bRedirectedDamage += aDamage;
        }
        if (this.playerBModifiers.alsoInflictedToOpponent) {
            aRedirectedDamage += bDamage;
        }

        // 04: Battle damage is treated as effect damage.
        if (this.playerAModifiers.convertToEffectDamage) {
            bEffectDamage = bDamage;
            bDamage = 0;
        }
        if (this.playerBModifiers.convertToEffectDamage) {
            aEffectDamage = aDamage;
            aDamage = 0;
        }
        // 05:A The player gains Life Points instead of taking battle damage.
        if (this.playerAModifiers.convertDamageTakenToHealing) {
            aDamage = -aDamage;
        }

        // 05:B The player gains Life Points instead of taking battle damage.
        if (this.playerBModifiers.convertDamageTakenToHealing) {
            bDamage = -bDamage;
        }

        // 06: Battle damage becomes 0.
        if (this.playerBModifiers.cannotDealDamage) {
            aDamage = 0;
        } else {
            // 07: Battle damage is halved.
            if (this.playerBModifiers.dealHalfDamage) {
                aDamage /= 2;
                bRedirectedDamage /= 2;
            }
            // 08: Battle damage is doubled.
            if (this.playerBModifiers.dealDoubleDamage) {
                aDamage *= 2;
            }
            // 09: Battle damage becomes X (X being a predetermined value).
            if (this.playerBModifiers.setToSpecificValue) {
                aDamage = this.playerBModifiers.specificValue;
            }
            // 10: You do not take battle damage if it is more or less than X.
            if (this.playerAModifiers.preventIfConditionMet && this.playerAModifiers.preventionCondition(aDamage)) {
                aDamage = 0;
            }
        }

        // 06: Battle damage becomes 0.
        if (this.playerAModifiers.cannotDealDamage) {
            bDamage = 0;
        } else {
            // 07: Battle damage is halved.
            if (this.playerAModifiers.dealHalfDamage) {
                bDamage /= 2;
                aRedirectedDamage /= 2;
            }
            // 08: Battle damage is doubled.
            if (this.playerAModifiers.dealDoubleDamage) {
                bDamage *= 2;
            }
            // 09: Battle damage becomes X (X being a predetermined value).
            if (this.playerAModifiers.setToSpecificValue) {
                bDamage = this.playerAModifiers.specificValue;
            }
            // 10: You do not take battle damage if it is more or less than X.
            if (this.playerBModifiers.preventIfConditionMet && this.playerBModifiers.preventionCondition(bDamage)) {
                bDamage = 0;
            }
        }

        result.playerA.battleDamage = aDamage;
        result.playerB.battleDamage = bDamage;
        result.playerA.redirectedDamage = aRedirectedDamage;
        result.playerB.redirectedDamage = bRedirectedDamage;
        result.playerA.effectDamage = aEffectDamage;
        result.playerB.effectDamage = bEffectDamage;

        return result;
    }
}

export const createDamageCalculator = () => new DamageCalculator();
