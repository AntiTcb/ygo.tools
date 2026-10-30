import { describe, expect, it } from 'vitest';
import { humanizeAction, humanizeTrigger, humanTarget } from './humanize';
import { tagActionSchema, tagTriggerSchema } from './tagSchema';

const action = (a: Record<string, unknown>) => humanizeAction(tagActionSchema.parse(a));
const trigger = (t: Record<string, unknown>) => humanizeTrigger(tagTriggerSchema.parse(t));

describe('humanTarget', () => {
  it('writes targets like card text', () => {
    expect(humanTarget({ rank: { op: 'lte', value: 4 }, monster_kinds: ['xyz'], card_types: ['monster'] })).toBe('Rank 4 or lower Xyz monster');
    expect(humanTarget({ exclude_monster_kinds: ['fusion'], card_types: ['monster'] }, true)).toBe('non-Fusion monsters');
    expect(humanTarget({ spell_trap_types: ['quick_play'], card_types: ['spell'] })).toBe('Quick-Play Spell');
    expect(humanTarget({ attributes: ['WATER'], races: ['Machine'], atk: { op: 'lte', value: 1600 }, card_types: ['monster'] })).toBe(
      'WATER Machine monster with 1600 or lower ATK',
    );
    expect(humanTarget(null)).toBe('card');
    expect(humanTarget({ races: ['Machine'], exclude_attributes: ['WATER'], atk: { op: 'lte', value: 1600 } })).toBe(
      'non-WATER Machine monster with 1600 or lower ATK',
    );
  });
});

describe('humanizeAction', () => {
  it('describes summons with quantity and zones', () => {
    expect(
      action({ verb: 'special_summon', quantity: 1, target: { races: ['Aqua'], card_types: ['monster'] }, from_zones: ['gy'], from_side: 'you' }),
    ).toBe('Special Summons 1 Aqua monster from your GY');
    expect(
      action({
        verb: 'special_summon',
        quantity: 2,
        target: { exclude_monster_kinds: ['fusion'], card_types: ['monster'] },
        from_zones: ['banished', 'gy'],
        from_side: 'either',
      }),
    ).toBe("Special Summons 2 non-Fusion monsters from either player's banishment or GY");
  });

  it('uses the destination the verb implies, and names', () => {
    expect(
      action({ verb: 'add_to_hand', quantity: 1, name_refs: ['Dark Magician'], from_zones: ['deck'], to_zones: ['hand'], from_side: 'you' }),
    ).toBe('Adds 1 "Dark Magician" from your Deck to the hand');
  });

  it('marks costs and handles the card itself', () => {
    expect(action({ verb: 'discard', is_self: true, is_cost: true, from_zones: ['hand'] })).toBe('Cost: discards this card from the hand');
  });

  it('describes player-affecting verbs and stat changes', () => {
    expect(action({ verb: 'inflict_damage', to_side: 'opponent', stat_amount: 800 })).toBe('Inflicts 800 damage to your opponent');
    expect(action({ verb: 'draw', quantity: 2 })).toBe('Draws 2 cards');
    expect(action({ verb: 'change_stats', is_self: true, stat: 'atk', stat_mode: 'gain', stat_amount: 500 })).toBe('This card gains 500 ATK');
  });

  it('falls back to the verb name for verbs added later', () => {
    expect(action({ verb: 'shuffle_into_deck', quantity: 1 })).toBe('Shuffle into deck 1 card');
  });
});

describe('humanizeTrigger', () => {
  it('describes the Atlantean trigger', () => {
    expect(
      trigger({
        event: 'send_to_gy',
        subject_is_self: true,
        cause: 'cost',
        cause_card: { attributes: ['WATER'], card_types: ['monster'] },
      }),
    ).toBe("When this card is sent to the GY as a cost for a WATER monster's effect");
  });

  it('uses articles and controller', () => {
    expect(trigger({ event: 'attack_declared', subject: { card_types: ['monster'] }, subject_side: 'opponent' })).toBe(
      'When a monster your opponent controls declares an attack',
    );
    expect(trigger({ event: 'destroy', subject_is_self: true, cause: 'battle' })).toBe('When this card is destroyed by battle');
  });
});
