import { describe, expect, it } from 'vitest';
import { describeAction, describeTrigger } from './describe';
import { tagActionSchema, tagTriggerSchema } from './tagSchema';

describe('describeAction', () => {
  it('renders costs, quantities, targets, zones and stat changes', () => {
    expect(
      describeAction(
        tagActionSchema.parse({ verb: 'special_summon', from_zones: ['deck'], from_side: 'you', quantity: 1, target: { archetypes: ['Frog'] } }),
      ),
    ).toBe('special_summon 1 × "Frog" card from your deck');
    expect(describeAction(tagActionSchema.parse({ verb: 'discard', from_zones: ['hand'], is_cost: true, is_self: true }))).toBe(
      'COST: discard this card from hand',
    );
    expect(describeAction(tagActionSchema.parse({ verb: 'special_summon', quantity: 1, name_refs: ['Dark Magician'], from_zones: ['deck'] }))).toBe(
      'special_summon 1 × "Dark Magician" from deck',
    );
    expect(
      describeAction(tagActionSchema.parse({ verb: 'change_stats', is_self: true, stat: 'atk', stat_mode: 'gain', stat_amount_note: 'x 1000' })),
    ).toBe('change_stats this card [atk gain (x 1000)]');
    expect(describeAction(tagActionSchema.parse({ verb: 'special_summon', to_side: 'opponent', quantity: 3 }))).toBe(
      "special_summon 3 × any card to opponent's side",
    );
  });
});

describe('describeTrigger', () => {
  it('renders self, subjects and causes', () => {
    expect(
      describeTrigger(
        tagTriggerSchema.parse({
          event: 'send_to_gy',
          subject_is_self: true,
          cause: 'cost',
          cause_card: { card_types: ['monster'], attributes: ['WATER'] },
        }),
      ),
    ).toBe('send_to_gy: this card by cost of WATER monster');
    expect(
      describeTrigger(tagTriggerSchema.parse({ event: 'attack_declared', subject: { card_types: ['monster'] }, subject_side: 'opponent' })),
    ).toBe("attack_declared: monster (opponent's)");
  });
});
