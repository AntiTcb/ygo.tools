export type MonsterProps = {
    atk: number;
    def: number;
    position: 'ATK' | 'DEF';
    hasPiercing: boolean;
};

export class BattleModifiers {
    inflictsDoubleDamage: boolean = false;
    damageToBothPlayers: boolean = false;
    redirectToOpponent: boolean = false;
    alsoInflictedToOpponent: boolean = false;
    convertToEffectDamage: boolean = false;
    convertToHealing: boolean = false;
    preventDamage: boolean = false;
    halveDamage: boolean = false;
    doubleDamage: boolean = false;
    setToSpecificValue: boolean = false;
    specificValue: number = 0;
    preventIfConditionMet: boolean = false;
    comparison: '>' | '>=' | '<' | '<=' = '>';
    preventionDamageValue: number = 0;

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
    battleModifiers = $state<{ playerA: BattleModifiers; playerB: BattleModifiers }>({ playerA: new BattleModifiers(), playerB: new BattleModifiers() });
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
        if (this.battleModifiers.playerA.inflictsDoubleDamage) {
            bDamage *= 2;
        } else if (this.battleModifiers.playerB.inflictsDoubleDamage) {
            aDamage *= 2;
        }

        // 02: Battle damage is taken by both players
        if (this.battleModifiers.playerA.damageToBothPlayers || this.battleModifiers.playerB.damageToBothPlayers) {
            if (aDamage > 0) {
                bDamage = aDamage;
            } else if (bDamage > 0) {
                aDamage = bDamage;
            }
        }

        // 03: Your opponent takes the battle damage instead
        if (this.battleModifiers.playerA.redirectToOpponent) {
            bRedirectedDamage = aDamage;
            aDamage = 0;
        }
        if (this.battleModifiers.playerB.redirectToOpponent) {
            aRedirectedDamage = bDamage;
            bDamage = 0;
        }
        // 03.5: Battle damage you take is also inflicted to your opponent
        if (this.battleModifiers.playerA.alsoInflictedToOpponent) {
            bRedirectedDamage += aDamage;
        }
        if (this.battleModifiers.playerB.alsoInflictedToOpponent) {
            aRedirectedDamage += bDamage;
        }

        // 04: Battle damage is treated as effect damage.
        if (this.battleModifiers.playerA.convertToEffectDamage) {
            bEffectDamage = bDamage;
            bDamage = 0;
        } else if (this.battleModifiers.playerB.convertToEffectDamage) {
            aEffectDamage = aDamage;
            aDamage = 0;
        }
        // 05: The player gains Life Points instead of taking battle damage.
        if (this.battleModifiers.playerA.convertToHealing) {
            aDamage = -aDamage;
        } else {
            // 06: Battle damage becomes 0.
            if (this.battleModifiers.playerA.preventDamage) {
                aDamage = 0;
            } else {
                // 07: Battle damage is halved.
                if (this.battleModifiers.playerB.halveDamage) {
                    aDamage /= 2;
                }
                // 08: Battle damage is doubled.
                if (this.battleModifiers.playerB.doubleDamage) {
                    aDamage *= 2;
                }
                // 09: Battle damage becomes X (X being a predetermined value).
                if (this.battleModifiers.playerB.setToSpecificValue) {
                    aDamage = this.battleModifiers.playerB.specificValue;
                }
                // 10: You do not take battle damage if it is more or less than X.
                if (this.battleModifiers.playerA.preventIfConditionMet && this.battleModifiers.playerA.preventionCondition(aDamage)) {
                    aDamage = 0;
                }
            }
        }

        // 05:B
        if (this.battleModifiers.playerB.convertToHealing) {
            bDamage = -bDamage;
        } else {
            // 06
            if (this.battleModifiers.playerB.preventDamage) {
                bDamage = 0;
            } else {
                // 07
                if (this.battleModifiers.playerA.halveDamage) {
                    bDamage /= 2;
                }
                // 08
                if (this.battleModifiers.playerA.doubleDamage) {
                    bDamage *= 2;
                }
                // 09
                if (this.battleModifiers.playerA.setToSpecificValue) {
                    bDamage = this.battleModifiers.playerA.specificValue;
                }
                // 10
                if (this.battleModifiers.playerB.preventIfConditionMet && this.battleModifiers.playerB.preventionCondition(bDamage)) {
                    bDamage = 0;
                }
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
