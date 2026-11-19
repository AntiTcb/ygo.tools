import { describe, expect, it } from 'vitest';
import { fixTagEffects, fixTarget, summonFromZones } from './tagFixes';
import type { TagAction, TagEffect, Target } from './tagSchema';

const lte4 = { op: 'lte', value: 4 } as const;

describe('fixTarget', () => {
  it('keeps only the printed stat when Level/Rank/Link were all tagged', () => {
    const t: Target = {
      card_types: ['monster'],
      level: lte4,
      rank: lte4,
      link_rating: lte4,
      any_of: [{ races: ['Warrior'] }, { races: ['Warrior'] }],
    };
    expect(fixTarget(t, 'Add 1 Level 4 or lower Warrior monster from your Deck to your hand.')).toEqual({
      races: ['Warrior'],
      card_types: ['monster'],
      level: lte4,
    });
  });

  it('turns "Level/Rank" into alternatives', () => {
    expect(fixTarget({ level: lte4, rank: lte4 }, 'Target 1 Level/Rank 4 or lower monster')).toEqual({ any_of: [{ level: lte4 }, { rank: lte4 }] });
  });

  it('keeps distinct alternatives and returns unchanged targets as-is', () => {
    const t: Target = { any_of: [{ races: ['Aqua'] }, { attributes: ['WATER'] }] };
    expect(fixTarget(t, 'an Aqua or WATER monster')).toBe(t);
    const reordered: Target = { level: { op: 'eq', value: 1 }, any_of: [{ level: lte4 }, { races: ['Aqua'] }], card_types: ['monster'] };
    expect(fixTarget(reordered, 'Level 1')).toBe(reordered);
    const r: Target = { rank: lte4, monster_kinds: ['xyz'] };
    expect(fixTarget(r, 'Rank 4 or lower Xyz Monster')).toBe(r);
    expect(fixTarget(null, '')).toBeNull();
  });
});

describe('summonFromZones', () => {
  it('reads the zone aside', () => {
    expect(summonFromZones('you can Special Summon this card (from your hand).')).toEqual(['hand']);
    expect(summonFromZones('Special Summon this card (from your hand or GY).')).toEqual(['hand', 'gy']);
    expect(summonFromZones('Special Summon this card (from your hand, Deck, or GY).')).toEqual(['hand', 'deck', 'gy']);
    expect(summonFromZones('(from your face-up Extra Deck)')).toEqual(['extra_deck']);
  });

  it('gives up on anything unclear', () => {
    expect(summonFromZones('Special Summon this card.')).toBeNull();
    expect(summonFromZones('(from your hand) ... (from your GY)')).toBeNull();
    expect(summonFromZones('(from your hand or field)')).toBeNull();
  });
});

const action = (a: Partial<TagAction>): TagAction =>
  ({
    verb: 'special_summon',
    from_zones: [],
    to_zones: [],
    from_side: null,
    to_side: null,
    is_cost: false,
    is_self: true,
    quantity: null,
    target: null,
    name_refs: [],
    contextual: false,
    context_note: null,
    stat: null,
    stat_mode: null,
    stat_amount: null,
    stat_amount_note: null,
    ...a,
  }) as TagAction;

describe('fixTagEffects', () => {
  it('fills the zone of a self summon and leaves good effects untouched', () => {
    const fixable = {
      snippet: 'If you control no monsters, you can Special Summon this card (from your hand).',
      actions: [action({})],
      triggers: [],
    };
    const fine = { snippet: 'Special Summon this card (from your hand).', actions: [action({ from_zones: ['hand'] })], triggers: [] };
    const [a, b] = fixTagEffects([fixable, fine] as unknown as TagEffect[]);
    expect(a!.actions[0]!.from_zones).toEqual(['hand']);
    expect(b).toBe(fine);
  });
});
