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
    condition: (battleDamage: number, comparison: '>' | '<', damageValue: number) => boolean = () => false;

    // string indexer to only properties that are boolean
    [key: string]: boolean | number | ((battleDamage: number, comparison: '>' | '<', damageValue: number) => boolean);
}

class DamageCalculator {
    attackingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    defendingMonster = $state<MonsterProps>({ atk: 0, def: 0, position: 'ATK', hasPiercing: false });
    battleModifiers = $state<{ playerA: BattleModifiers; playerB: BattleModifiers }>({ playerA: defaultModifiers(), playerB: defaultModifiers() });
    battleResult = $derived.by(() => this.calculateBattleDamage());

    calculateBattleDamage() {
        const result = {
            attackingPlayer: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            defendingPlayer: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
        };
        // determine initial battle damage
        const attackingBattleValue = this.attackingMonster.position === 'ATK' ? this.attackingMonster.atk : this.attackingMonster.def;
        const defendingBattleValue = this.defendingMonster.position === 'ATK' ? this.defendingMonster.atk : this.defendingMonster.def;
        const isPiercedAttack = this.attackingMonster.hasPiercing && this.defendingMonster.position === 'DEF';
        const damageAmount = attackingBattleValue - defendingBattleValue;

        let aDamage = 0,
            bDamage = 0,
            aRedirectedDamage = 0,
            bRedirectedDamage = 0,
            aEffectDamage = 0,
            bEffectDamage = 0;

        console.log('damage', damageAmount);

        if (damageAmount < 0) {
            aDamage = Math.abs(damageAmount);
        } else {
            bDamage = isPiercedAttack
                ? damageAmount
                : this.attackingMonster.position === 'ATK' && this.defendingMonster.position === 'ATK'
                  ? damageAmount
                  : 0;
        }

        // 01
        if (this.battleModifiers.playerA.inflictsDoubleDamage) {
            bDamage *= 2;
        } else if (this.battleModifiers.playerB.inflictsDoubleDamage) {
            aDamage *= 2;
        }

        if (this.battleModifiers.playerA.redirectToOpponent) {
            bRedirectedDamage = aDamage;
            aDamage = 0;
        } else if (this.battleModifiers.playerB.redirectToOpponent) {
            aRedirectedDamage = bDamage;
            bDamage = 0;
        }
        if (this.battleModifiers.playerA.alsoInflictedToOpponent) {
            bRedirectedDamage += aDamage;
        } else if (this.battleModifiers.playerB.alsoInflictedToOpponent) {
            aRedirectedDamage += bDamage;
        }

        // 04
        if (this.battleModifiers.playerA.convertToEffectDamage) {
            bEffectDamage = bDamage;
            bDamage = 0;
        } else if (this.battleModifiers.playerB.convertToEffectDamage) {
            aEffectDamage = aDamage;
            aDamage = 0;
        }
        // 05
        if (this.battleModifiers.playerA.convertToHealing) {
            aDamage = -aDamage;
        } else if (this.battleModifiers.playerB.convertToHealing) {
            bDamage = -bDamage;
        }
        // 06
        if (this.battleModifiers.playerA.preventDamage && !this.battleModifiers.playerA.convertToHealing) {
            aDamage = 0;
        } else if (this.battleModifiers.playerB.preventDamage) {
            bDamage = 0;
        }
        // 07
        if (this.battleModifiers.playerA.halveDamage && !this.battleModifiers.playerA.convertToHealing) {
            aDamage /= 2;
        } else if (this.battleModifiers.playerB.halveDamage) {
            bDamage /= 2;
        }
        // 08
        if (this.battleModifiers.playerA.doubleDamage && !this.battleModifiers.playerA.convertToHealing) {
            aDamage *= 2;
        } else if (this.battleModifiers.playerB.doubleDamage) {
            bDamage *= 2;
        }
        // 09
        if (this.battleModifiers.playerA.setToSpecificValue && !this.battleModifiers.playerA.convertToHealing) {
            aDamage = this.battleModifiers.playerA.specificValue;
        } else if (this.battleModifiers.playerB.setToSpecificValue) {
            bDamage = this.battleModifiers.playerB.specificValue;
        }
        // 10

        result.attackingPlayer.battleDamage = aDamage;
        result.defendingPlayer.battleDamage = bDamage;
        result.attackingPlayer.redirectedDamage = aRedirectedDamage;
        result.defendingPlayer.redirectedDamage = bRedirectedDamage;

        return result;
    }
}

const defaultModifiers = () =>
    ({
        inflictsDoubleDamage: false,
        damageToBothPlayers: false,
        redirectToOpponent: false,
        alsoInflictedToOpponent: false,
        convertToEffectDamage: false,
        convertToHealing: false,
        preventDamage: false,
        halveDamage: false,
        doubleDamage: false,
        setToSpecificValue: false,
        specificValue: 0,
        preventIfConditionMet: false,
        condition: () => false,
    }) satisfies BattleModifiers;

export const createDamageCalculator = () => new DamageCalculator();
