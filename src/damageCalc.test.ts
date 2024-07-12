import { createDamageCalculator, type BattleResult, type DamageCalculator } from '$lib/damageCalc.svelte';
import { beforeEach, describe, expect, test } from 'vitest';

let damageCalc: DamageCalculator;

const NO_DAMAGE = {
    playerA: {
        battleDamage: 0,
        lifeGained: 0,
        effectDamage: 0,
        redirectedDamage: 0,
    },
    playerB: {
        battleDamage: 0,
        lifeGained: 0,
        effectDamage: 0,
        redirectedDamage: 0,
    },
} satisfies BattleResult;

describe('Basic calculations:', () => {
    test('(1000 ATK) vs (1000 ATK) should be no damage', () => {
        damageCalc.attackingMonster = {
            atk: 1000,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };
        damageCalc.defendingMonster = {
            atk: 1000,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };

        expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
    });
    test('(1000 ATK) vs (600 DEF) should be no damage', () => {
        damageCalc.attackingMonster = {
            atk: 1000,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };
        damageCalc.defendingMonster = {
            atk: 500,
            def: 0,
            position: 'DEF',
            hasPiercing: false,
        };

        expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
    });
    test('(4000 ATK | Piercing) vs (600 DEF) should be (PlayerB: 3400 damage)', () => {
        damageCalc.attackingMonster = {
            atk: 4000,
            def: 0,
            position: 'ATK',
            hasPiercing: true,
        };
        damageCalc.defendingMonster = {
            atk: 0,
            def: 600,
            position: 'DEF',
            hasPiercing: false,
        };

        expect(damageCalc.battleResult).toStrictEqual({
            ...NO_DAMAGE,
            playerB: {
                ...NO_DAMAGE.playerB,
                battleDamage: 3400
            },
        });
    });
    test('(1000 ATK) vs (2500 ATK) should be (PlayerA: 1500 damage)', () => {
        damageCalc.attackingMonster = {
            atk: 1000,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };
        damageCalc.defendingMonster = {
            atk: 2500,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };

        expect(damageCalc.battleResult).toStrictEqual({
            ...NO_DAMAGE,
            playerA: {
                ...NO_DAMAGE.playerA,
                battleDamage: 1500
            },
        });
    });
    test('(1000 ATK) vs (2100 DEF) should be (PlayerA: 1100 damage)', () => {
        damageCalc.attackingMonster = {
            atk: 1000,
            def: 0,
            position: 'ATK',
            hasPiercing: false,
        };
        damageCalc.defendingMonster = {
            atk: 0,
            def: 2100,
            position: 'DEF',
            hasPiercing: false,
        };

        expect(damageCalc.battleResult).toStrictEqual({
            ...NO_DAMAGE,
            playerA: {
                ...NO_DAMAGE.playerA,
                battleDamage: 1100
            },
        });
    });
    test('(2600 DEF) vs (4000 ATK | Piercing) should be (PlayerA: 1400 damage)', () => {
        damageCalc.attackingMonster = {
            atk: 0,
            def: 2600,
            position: 'DEF',
            hasPiercing: false,
        };
        damageCalc.defendingMonster = {
            atk: 4000,
            def: 0,
            position: 'ATK',
            hasPiercing: true,
        };

        expect(damageCalc.battleResult).toStrictEqual({
            ...NO_DAMAGE,
            playerA: { ...NO_DAMAGE.playerA,
                battleDamage: 1400 },
        });
    });
});

describe('Modifiers:', () => {
    describe('Basic:', () => {
        describe('01: Inflicts double battle damage', () => {
            test('(4000 ATK | [01]) vs (600 ATK) should be (PlayerB: 6800 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 6800 },
                })
            });
            test('(600 ATK) vs (4000 ATK | [01]) should be (PlayerA: 6800 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 6800 },
                });
            });
            test('(1000 ATK | [01]) vs (1000 ATK | [01]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(1000 ATK) vs (2500 DEF | [01]) should be (PlayerA: 3000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 2500,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 3000 },
                });
            });
            test('(2500 ATK | Piercing | [01]) vs (1000 DEF) should be (PlayerB: 3000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 1000,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 3000 },
                });
            });
        });
        describe('02: Damage to both players', () => {
            test('(1000 ATK | [02]) vs (2500 ATK) should be (PlayerA: 1500 damage) and (PlayerB: 1500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1500 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1500 },
                });
            });
            test('(1000 ATK | [02]) vs (500 ATK | [02]) should be (PlayerA: 500 damage) and (PlayerB: 500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 500 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 500 },
                });
            });
            test('(1000 ATK | [02]) vs (2500 DEF) should be (PlayerA: 1500 damage) and (PlayerB: 1500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 2500,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1500 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1500 },
                });
            });
            test('(1000 ATK | [02]) vs (2500 DEF | [02]) should be (PlayerA: 1500 damage) and (PlayerB: 1500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 2500,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1500 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1500 },
                });
            });
            test('(4000 ATK | Piercing) vs (600 DEF | [02]) should be (PlayerA: 3400 damage) and (PlayerB: 3400 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 600,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 3400 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 3400 },
                });
            });
        });
        describe('03: Your opponent takes any battle damage you would take instead', () => {
            test('(1000 ATK | [03]) vs (2500 ATK) should be (PlayerB: 1500 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 1500 },
                });
            });
            test('(1000 ATK) vs (2500 ATK | [03]) should be (PlayerA: 1500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1500 },
                });
            });
            test('(4000 ATK | Piercing) vs (600 DEF | [03]) should be (PlayerA: 3400 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 600,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerB, redirectedDamage: 3400 },
                });
            });
            test('(2000 ATK | [03]) vs (0 ATK | [03]) should be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 2000 },
                });
            });
        });
        describe('03.5: Battle damage you take is also inflicted to your opponent', () => {
            test('(1000 ATK | [03.5]) vs (2500 ATK) should be (PlayerA: 1500 damage) and (PlayerB: 1500 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1500 },
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 1500 },
                });
            });
            test('(2500 ATK) vs (1000 ATK | [03.5]) should be (PlayerA: 1500 redirected) and (PlayerB: 1500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 1500 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1500 },
                });
            });
            test('(2100 ATK | [03.5]) vs (2700 ATK | [03.5]) should be (PlayerA: 600 damage) and (PlayerB: 600 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2100,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2700,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 600 },
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 600 },
                });
            });
            test('(2700 ATK | [03.5]) vs (2100 ATK | [03.5]) should be (PlayerA: 600 redirected) and (PlayerB: 600 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2700,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2100,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 600 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 600 },
                });
            });
        });
        describe('04: Battle damage is treated as effect damage', () => {
            test('(2500 ATK | [04]) vs (1000 ATK) should be (PlayerB: 1500 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, effectDamage: 1500 },
                });
            });
            test('(1000 ATK) vs (2500 ATK | [04]) should be (PlayerA: 1500 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, effectDamage: 1500 },
                });
            });
        });
        describe('05: The player gains Life Points instead of taking battle damage', () => {
            test('(2000 ATK | [05]) vs (1500 ATK) should be (PlayerB: 500 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 500 },
                });
            });
            test('(1500 ATK | [05]) vs (2000 ATK) should be (PlayerA: 500 lifeGained)', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, lifeGained: 500 },
                });
            });
        });
        describe('06: Battle damage becomes 0', () => {
            test('(1800 ATK | [06]) vs (2000 ATK) should be (PlayerA: 200 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1800,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 200 },
                });
            });
            test('(2000 ATK) vs (1800 ATK | [06]) should be (PlayerB: 200 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1800,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 200 },
                });
            });
            test('(2000 ATK | [06]) vs (1000 ATK) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK) vs (3000 ATK | [06]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
        });
        describe('07: Battle damage is halved', () => {
            test('(2000 ATK | [07]) vs (1500 ATK) should be (PlayerB: 250 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsHalved = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 250 },
                });
            });
            test('(1500 ATK) vs (2000 ATK | [07]) should be (PlayerA: 250 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDealIsHalved = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 250 },
                });
            });
        });
        describe('08: Battle damage is doubled', () => {
            test('(3000 ATK | [08]) vs (2000 ATK) should be (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 2000 }
                });
            });
            test('(2000 ATK) vs (2500 ATK | [08]) should be (PlayerA: 1000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1000 }
                });
            });
        });
        describe('09: Battle damage becomes X (X being a predetermined value)', () => {
            test('(3000 ATK | [09:100]) vs (0 ATK) should be (PlayerB: 100 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerAModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 100 }
                });
            });
            test('(2000 ATK) vs (0 ATK | [09:100]) should be (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerBModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 2000 }
                });
            });
        });
        describe('10: You do not take battle damage if it is more or less than X', () => {
            test('(2000 ATK) vs (1500 ATK | [10:<:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(1500 ATK | [10:>:250]) vs (2000 ATK) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerAModifiers.damagePreventionComparison = '>';
                damageCalc.playerAModifiers.damagePreventionValue = 250;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK) vs (0 ATK | [10:>=:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK) vs (0 ATK | [10:<=:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK) vs (0 ATK | [10:<:2000]) should be (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: {...NO_DAMAGE.playerB, battleDamage: 2000 },
                });
            });
            test('(1500 ATK | [10:>:250]) vs (1600 ATK) should be (PlayerA: 100 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerAModifiers.damagePreventionComparison = '>';
                damageCalc.playerAModifiers.damagePreventionValue = 250;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 100 },
                });
            });
            test('(1000 ATK) vs (0 ATK | [10:>=:2000]) should be (PlayerB: 1000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1000 },
                });
            });
            test('(3000 ATK) vs (0 ATK | [10:<=:2000]) should be (PlayerB: 3000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 3000 },
                });
            });
        });
    });

    describe('Combinations:', () => {
        describe('[01, 02]:', () => {
            test('(4000 ATK | [01]) vs (600 ATK | [02]) should be (PlayerA: 6800 damage) and (PlayerB: 6800 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 6800 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 6800 },
                });
            });
            test('(4000 ATK | [01, 02]) vs (600 ATK) should be (PlayerA: 6800 damage) and (PlayerB: 6800 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 6800 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 6800 },
                });
            });
            test('(2000 ATK) vs (4000 ATK | [01, 02]) should be (PlayerA: 4000 damage) and (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 4000 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                });
            });
        });
        describe('[01, 03]:', () => {
            test('(4000 ATK | [01]) vs (600 ATK | [03]) should be (PlayerA: 6800 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 6800 },
                });
            });
            test('(1000 ATK | [03]) vs (2500 ATK | [01]) should be (PlayerB: 3000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 3000 },
                });
            });
            test('(4000 ATK | [01, 03]) vs (2000 ATK) should be (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                });
            });
            test('(1000 ATK) vs (2000 ATK | [01, 03]) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 2000 },
                });
            });
            test('(3000 ATK | [01, 03]) vs (2000 ATK | [01, 03]) should be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 2000 },
                });
            });
        });
        describe('[01, 03.5]:', () => {
            test('(2000 ATK | [01]) vs (1000 ATK | [03.5]) should be (PlayerA: 2000 redirected) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 2000 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 2000 },
                });
            });
            test('(2000 ATK | [01, 03.5]) vs (3000 ATK) should be (PlayerA: 1000 damage) and (PlayerB: 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 1000 },
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 1000 },
                });
            });
            test('(2000 ATK | [01, 03.5]) vs (0 ATK) should be (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                });
            });
            test('(4000 ATK | [01]) vs (600 ATK | [03.5]) should be (PlayerA: 6800 redirected) and (PlayerB: 6800 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, redirectedDamage: 6800 },
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 6800 },
                });
            });
            test('(1000 ATK | [03.5]) vs (2500 ATK | [01]) should be (PlayerA: 3000 damage) and (PlayerB: 3000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, battleDamage: 3000 },
                    playerB: { ...NO_DAMAGE.playerB, redirectedDamage: 3000 },
                });
            });
        });
        describe('[01, 04]:', () => {
            test('(2000 ATK | [01, 04]) vs (1000 ATK) should be (PlayerB: 2000 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, effectDamage: 2000 },
                });
            });
            test('(1000 ATK) vs (2000 ATK | [01, 04]) should be (PlayerA: 2000 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, effectDamage: 2000 },
                });
            });
        });
        describe('[01, 05]:', () => {
            test('(2000 ATK | [01]) vs (1000 ATK | [05]) should be (PlayerB: 2000 lifeGained)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerA, lifeGained: 2000 },
                });
            });
            test('(1000 ATK | [05]) vs (2000 ATK | [01]) should be (PlayerA: 2000 lifeGained)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerA, lifeGained: 2000 }
                })
            });
        });
        describe('[01, 06]:', () => {
            test('(2000 ATK | [01]) vs (1000 ATK | [06]) should be (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 2000 },
                });
            });
            test('(2000 ATK | [01, 06]) vs (1000 ATK) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(4000 ATK | [01, 06]) vs (2000 ATK | [01, 06]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
        });
        describe('[01, 07]:', () => {
            test('(2000 ATK | [01, 07]) vs (1000 ATK) should be (PlayerB: 1000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsHalved = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 1000 },
                })
            });
            test('(2000 ATK) vs (3000 ATK | [01, 07]) should be (PlayerA: 1000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealIsHalved = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerB, battleDamage: 1000 },
                });
            });
        });
        describe('[01, 08]:', () => {
            test('(2000 ATK | [01, 08]) vs (1000 ATK) should be (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                })
            });
            test('(2000 ATK) vs (3000 ATK | [01, 08]) should be (PlayerA: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                });
            });
        });
        describe('[01, 09]:', () => {
            test('(2000 ATK | [01, 09:100]) vs (1000 ATK) should be (PlayerB: 100 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerAModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 100 },
                })
            });
            test('(2000 ATK) vs (3000 ATK | [01, 09:100]) should be (PlayerA: 100 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerBModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerB, battleDamage: 100 },
                });
            });
        });
        describe('[01, 10]:', () => {
            test('(2000 ATK | [01]) vs (1500 ATK | [10:<:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(1500 ATK | [10:>:250]) vs (2000 ATK | [01]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerAModifiers.damagePreventionComparison = '>';
                damageCalc.playerAModifiers.damagePreventionValue = 250;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK | [01]) vs (0 ATK | [10:>=:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
            test('(2000 ATK | [01]) vs (0 ATK | [10:<=:2000]) should be (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                })
            });
            test('(2000 ATK | [01]) vs (0 ATK | [10:<:2000]) should be (PlayerB: 4000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 4000 },
                })
            });
            test('(1500 ATK | [10:>:250]) vs (1600 ATK | [01]) should be (PlayerA: 200 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerAModifiers.damagePreventionComparison = '>';
                damageCalc.playerAModifiers.damagePreventionValue = 250;
                damageCalc.playerBModifiers.inflictsDoubleBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: { ...NO_DAMAGE.playerB, battleDamage: 200 },
                })
            });
            test('(1000 ATK | [01]) vs (0 ATK | [10:>=:2000]) should be (PlayerB: 0 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 0 },
                })
            });
            test('(3000 ATK | [01]) vs (0 ATK | [10:<=:2000]) should be (PlayerB: 6000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: { ...NO_DAMAGE.playerB, battleDamage: 6000 },
                })
            });
        });

        describe('[02, 03]:', () => {
            test('(2000 ATK | [02, 03]) vs (0 ATK) should be (PlayerB: 2000 damage, 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02, 03]) vs (0 ATK | [03]) should be (PlayerA: 2000 redirected) and (PlayerB: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[02, 03.5]:', () => {
            test('(2000 ATK | [02]) vs (0 ATK | [03.5]) should be (PlayerA: 2000 damage, 2000 redirected) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            })
        });
        describe('[02, 04]:', () => {
            test('(2700 ATK | [02, 04]) vs (0 ATK) should be (PlayerA: 2700 damage) and (PlayerB: 2700 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2700,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2700,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        effectDamage: 2700,
                    },
                });
            });
            test('(2700 ATK | [04]) vs (0 ATK | [02]) should be (PlayerA: 2700 damage) and (PlayerB: 2700 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2700,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2700,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        effectDamage: 2700,
                    },
                });
            });
        });
        describe('[02, 05]:', () => {
            test('(2000 ATK | [02]) vs (0 ATK | [05]) should be (PlayerA: 2000 damage) and (PlayerB: -2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        lifeGained: 2000,
                    },
                });
            })
        });
        describe('[02, 06]:', () => {
            test('(2000 ATK | [02, 06]) vs (0 ATK) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 0,
                    },
                });
            });
        });
        describe('[02, 07]:', () => {
            test('(2000 ATK | [02, 07]) vs (0 ATK) should be (PlayerA: 2000 damage) and (PlayerB: 1000 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsHalved = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 1000,
                    },
                });
            });
        });
        describe('[02, 08]:', () => {
            test('(2000 ATK | [02, 08]) vs (0 ATK) should be (PlayerA: 2000 damage) and (PlayerB: 4000 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 4000,
                    },
                });
            });
        });
        describe('[02, 09]:', () => {
            test('(2000 ATK | [02, 09:100]) vs (0 ATK) should be (PlayerA: 2000 damage) and (PlayerB: 100 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerAModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 100,
                    },
                });
            });
        });
        describe('[02, 10]:', () => {
            test('(2000 ATK | [02]) vs (0 ATK | [10:<:2100]) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:<:2000]) should be (PlayerA: 2000 damage) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:>:1900]) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>';
                damageCalc.playerBModifiers.damagePreventionValue = 1900;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:>:2100]) should be (PlayerA: 2000 damage) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>';
                damageCalc.playerBModifiers.damagePreventionValue = 2100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:<=:2000]) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:<=:1900]) should be (PlayerA: 2000 damage) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<=';
                damageCalc.playerBModifiers.damagePreventionValue = 1900;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:>=:2000]) should be (PlayerA: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [02]) vs (0 ATK | [10:>=:2100]) should be (PlayerA: 2000 damage) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '>=';
                damageCalc.playerBModifiers.damagePreventionValue = 2100;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            });
        });

        describe('[03, 04]:', () => {
            test('(2000 ATK | [04]) vs (0 ATK | [03]) shhould be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[03, 05]:', () => {
            test('(2000 ATK) vs (0 ATK | [03, 05]) should be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerBModifiers.damageYouTakeIsConvertedToHealing = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[03, 06]:', () => {
            test('(2000 ATK | [06]) vs (0 ATK | [03]) should be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealBecomesZero = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[03, 07]:', () => {
            test('(2000 ATK | [07]) vs (0 ATK | [03]) should be (PlayerA: 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsHalved = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[03, 08]:', () => {
            test('(2000 ATK | [08]) vs (0 ATK | [03]) should be (PlayerA: 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsDoubled = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
        describe('[03, 09]:', () => {
            test('(2000 ATK | [03]) vs (3000 ATK | [09:1000]) should be (PlayerA: 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDoBecomesSpecificValue = true;
                damageCalc.playerBModifiers.specificValue = 1000;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        redirectedDamage: 1000,
                    },
                });
            });
        });
        describe('[03, 10]:', () => {
            test('(2000 ATK | [03]) vs (3000 ATK | [10:<:2000]) should be no damage', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsPreventedIf = true;
                damageCalc.playerBModifiers.damagePreventionComparison = '<';
                damageCalc.playerBModifiers.damagePreventionValue = 2000;
                damageCalc.playerBModifiers.preventedDamageType = 'battle';

                expect(damageCalc.battleResult).toStrictEqual(NO_DAMAGE);
            });
        });
        describe('[04, 05]:', () => {
            test('(2000 ATK | [04]) vs (0 ATK | [05:battle]) should be (PlayerB: 2000 effect)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageYouDealIsConvertedToEffectDamage = true;
                damageCalc.playerBModifiers.damageYouTakeIsConvertedToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        effectDamage: 2000,
                    },
                });
            });
        });

        describe('[01, 02, 03]:', () => {
            test('(2000 ATK | [01, 02]) vs (1000 ATK | [03]) should be (PlayerA: 2000 damage, 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                });
            });

            test('(4000 ATK | Piercing | [01]) vs (0 DEF | [02, 03]) should be (PlayerA: 8000 damage, 8000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 0,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 8000,
                        redirectedDamage: 8000,
                    },
                });
            });

            test('(4000 ATK | Piercing | [01]) vs (5000 DEF | [02, 03]) should be (PlayerA: 1000 damage, 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 4000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: true,
                };
                damageCalc.defendingMonster = {
                    atk: 0,
                    def: 5000,
                    position: 'DEF',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.yourOpponentTakesYourBattleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 1000,
                        redirectedDamage: 1000,
                    },
                });
            });
        });

        describe('[01, 02, 03.5]:', () => {
            test('(2000 ATK | [01, 02, 03.5]) vs (3000 ATK) should be (PlayerA: 1000 damage) and (PlayerB: 1000 damage, 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 3000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 1000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 1000,
                        redirectedDamage: 1000,
                    },
                });
            });
            test('(2000 ATK | [01, 02]) vs (1000 ATK | [03.5]) should be (PlayerA: 2000 damage, 2000 redirected) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [01, 02, 03.5]) vs (1000 ATK | [03.5]) should be (PlayerA: 2000 damage, 2000 redirected) and (PlayerB: 2000 damage)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                });
            });
            test('(2000 ATK | [01, 03.5]) vs (1000 ATK | [02]) should be (PlayerA: 2000 damage) and (PlayerB: 2000 damage, 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        battleDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                });
            });
        });

        describe('[02, 03, 03.5]:', () => {
            test('(2000 ATK | [02, 03]) vs (1000 ATK | [03.5]) should be (PlayerA: 1000 redirected) and (PlayerB: 1000 damage, 1000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 1000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 1000,
                        redirectedDamage: 1000,
                    },
                });
            });
        });

        describe('[02, 03, 08]:', () => {
            test('(2000 ATK | [02, 03]) vs (2500 ATK | [08]) should be (PlayerB: 500 damage, 500 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 2500,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerBModifiers.battleDamageYouDealIsDoubled = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 500,
                        redirectedDamage: 500,
                    },
                });
            })
        });

        describe('[01, 02, 03, 03.5]:', () => {
            test('(2000 ATK | [01, 02, 03, 03.5]) vs (1000 ATK | [03.5]) should be (PlayerA: 2000 redirected) and (PlayerB: 2000 damage, 2000 redirected)', () => {
                damageCalc.attackingMonster = {
                    atk: 2000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };
                damageCalc.defendingMonster = {
                    atk: 1000,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsTakenByBothPlayers = true;
                damageCalc.playerAModifiers.yourOpponentTakesYourBattleDamage = true;
                damageCalc.playerAModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;
                damageCalc.playerBModifiers.battleDamageIsAlsoInflictedToYourOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    ...NO_DAMAGE,
                    playerA: {
                        ...NO_DAMAGE.playerA,
                        redirectedDamage: 2000,
                    },
                    playerB: {
                        ...NO_DAMAGE.playerB,
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                    },
                });
            });
        });
    });
});

beforeEach(() => {
    damageCalc = createDamageCalculator();
});
