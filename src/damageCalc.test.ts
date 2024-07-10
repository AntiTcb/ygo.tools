import { createDamageCalculator, type DamageCalculator } from '$lib/damageCalc.svelte';
import { beforeEach, describe, expect, test } from 'vitest';

let damageCalc: DamageCalculator;

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

        expect(damageCalc.battleResult).toStrictEqual({
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
        });
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

        expect(damageCalc.battleResult).toStrictEqual({
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
        });
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
            playerA: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            playerB: {
                battleDamage: 3400,
                redirectedDamage: 0,
                effectDamage: 0,
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
            playerA: {
                battleDamage: 1500,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            playerB: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
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
            playerA: {
                battleDamage: 1100,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            playerB: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
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
            playerA: {
                battleDamage: 1400,
                redirectedDamage: 0,
                effectDamage: 0,
            },
            playerB: {
                battleDamage: 0,
                redirectedDamage: 0,
                effectDamage: 0,
            },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 3000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 3000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            })
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

                damageCalc.playerAModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerBModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 3400,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 3400,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        describe('03: Your opponent takes any battle damage you would take instead', () => {
            test('(1000 ATK | [03]) vs (2500 ATK) should be (PlayerB: 1500 damage)', () => {
                damageCalc.attackingMonster =  {
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

                damageCalc.playerAModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 1500,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
            test('(4000 ATK | Piercing) vs (600 DEF | [03]) should be (PlayerA: 3400 damage)', () => {
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

                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 3400,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
            test('(2000 ATK | [03]) vs (0 ATK | [03]) should be (PlayerA: 2000 damage)', () => {
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

                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        describe('03.5: Battle damage you take is also inflicted to your opponent', () => {
            test('(1000 ATK | [03.5]) vs (2500 ATK) should be (PlayerA: 1500 damage) and (PlayerB: 1500 damage)', () => {
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 1500,
                        effectDamage: 0,
                    },
                });
            });
            test('(2500 ATK) vs (1000 ATK | [03.5]) should be (PlayerA: 1500 damage) and (PlayerB: 1500 damage)', () => {
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

                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 1500,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 600,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 600,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 600,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 600,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });
        // 04: Battle damage is treated as effect damage.
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

                damageCalc.playerAModifiers.convertToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 1500,
                    },
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

                damageCalc.playerBModifiers.convertToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 1500,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });
        // 05: The player gains Life Points instead of taking battle damage.
        describe('05: The player gains Life Points instead of taking battle damage', () => {
            test('(2000 ATK | [05]) vs (1500 ATK) should be (PlayerA: -0 damage) and (PlayerB: 500 damage)', () => {
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

                damageCalc.playerAModifiers.convertDamageTakenToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: -0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
            test('(1500 ATK | [05]) vs (2000 ATK) should be (PlayerA: -500 damage)', () => {
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

                damageCalc.playerAModifiers.convertDamageTakenToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: -500,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        // 06: Battle damage becomes 0.
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

                damageCalc.playerAModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 200,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 200,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerBModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
            });
        });

        // 07: Battle damage is halved.
        describe('07: Battle damage is halved', () => {
            test('(2000 ATK | [07]) vs (1500 ATK) should be (PlayerA: 250 damage)', () => {
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

                damageCalc.playerAModifiers.dealHalfDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 250,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.dealHalfDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 250,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        // 08: Battle damage is doubled.
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

                damageCalc.playerAModifiers.dealDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.dealDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        // 09: Battle damage becomes X (X being a predetermined value).
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

                damageCalc.playerAModifiers.setToSpecificValue = true;
                damageCalc.playerAModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 100,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.setToSpecificValue = true;
                damageCalc.playerBModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 100,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        // 10: You do not take battle damage if it is more or less than X.
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<'
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.preventIfConditionMet = true;
                damageCalc.playerAModifiers.comparison = '>'
                damageCalc.playerAModifiers.preventionDamageValue = 250;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '>=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<'
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.preventIfConditionMet = true;
                damageCalc.playerAModifiers.comparison = '>'
                damageCalc.playerAModifiers.preventionDamageValue = 250;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 100,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '>=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 3000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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
                }
                damageCalc.defendingMonster = {
                    atk: 600,
                    def: 0,
                    position: 'ATK',
                    hasPiercing: false,
                };

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.damageToBothPlayers = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 6800,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.redirectToOpponent = true;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 3000,
                        effectDamage: 0,
                    },
                });
            });
            test('(4000 ATK | [01, 03]) vs (2000 ATK) should be (PlayerB: 4000 redirected)', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.redirectToOpponent = true;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerAModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 1000,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerAModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.convertToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 2000,
                    },
                });
            })
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.convertToEffectDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 2000,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });
        describe('[01, 05]:', () => {
            test('(2000 ATK | [01]) vs (1000 ATK | [05]) should be (PlayerB: -2000 damage)', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.convertDamageTakenToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: -2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
            test('(1000 ATK | [05]) vs (2000 ATK | [01]) should be (PlayerA: -2000 damage)', () => {
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.convertDamageTakenToHealing = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: -2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.cannotDealDamage = true;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.cannotDealDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.dealHalfDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.dealHalfDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.dealDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.dealDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.setToSpecificValue = true;
                damageCalc.playerAModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 100,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
            test('(2000 ATK) vs (3000 ATK | [01, 09:100]) should be (PlayerB: 100 damage)', () => {
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

                damageCalc.playerBModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.setToSpecificValue = true;
                damageCalc.playerBModifiers.specificValue = 100;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 100,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<'
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.preventIfConditionMet = true;
                damageCalc.playerAModifiers.comparison = '>'
                damageCalc.playerAModifiers.preventionDamageValue = 250;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '>=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<'
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 4000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerAModifiers.preventIfConditionMet = true;
                damageCalc.playerAModifiers.comparison = '>'
                damageCalc.playerAModifiers.preventionDamageValue = 250;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 200,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '>=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
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
                });
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.preventIfConditionMet = true;
                damageCalc.playerBModifiers.comparison = '<=';
                damageCalc.playerBModifiers.preventionDamageValue = 2000;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 6000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        describe('[03, 07]:', () => {
            test('(1000 ATK | [07]) vs (0 ATK | [03]) should be (PlayerA: 500 redirected)', () => {
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

                damageCalc.playerAModifiers.dealHalfDamage = true;
                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 500,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });

        describe('01, 02, 03:', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerBModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                });
            });
        });
        describe('01, 03.5:', () => {
            test('(4000 ATK | [01]) vs (600 ATK | [03.5]) should be (PlayerA: 6800 damage, 6800 redirected) and (PlayerB: 6800 damage)', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 6800,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 6800,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
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

                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerBModifiers.inflictsDoubleDamage = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 3000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 0,
                        redirectedDamage: 3000,
                        effectDamage: 0,
                    },
                });
            });
        });
        describe('01, 02, 03.5:', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 1000,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 1000,
                        redirectedDamage: 1000,
                        effectDamage: 0,
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 0,
                        effectDamage: 0,
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerBModifiers.damageToBothPlayers = true;
                damageCalc.playerAModifiers.redirectToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 0,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                });
            });
        });
        describe('01, 02, 03, 03.5:', () => {
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

                damageCalc.playerAModifiers.inflictsDoubleDamage = true;
                damageCalc.playerAModifiers.damageToBothPlayers = true;
                damageCalc.playerAModifiers.redirectToOpponent = true;
                damageCalc.playerAModifiers.alsoInflictedToOpponent = true;
                damageCalc.playerBModifiers.alsoInflictedToOpponent = true;

                expect(damageCalc.battleResult).toStrictEqual({
                    playerA: {
                        battleDamage: 0,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                    playerB: {
                        battleDamage: 2000,
                        redirectedDamage: 2000,
                        effectDamage: 0,
                    },
                });
            });
        });
    });
});

beforeEach(() => {
    damageCalc = createDamageCalculator();
});
