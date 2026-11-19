import { describe, expect, it } from 'vitest';
import { dropLeakedAlternatives, fixTagEffects, fixTarget, summonFromZones } from './tagFixes';
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

describe('leaked alternatives', () => {
  const summon = 'Send 1 other face-up card you control to the GY; Special Summon 1 Level 1 FIRE monster from your hand or Deck.';
  const search =
    'You can banish this card from your GY, then target 1 "Snake-Eye" or "Diabellstar" monster in your GY; add 1 Level 1 FIRE monster from your Deck to your hand.';
  const cardText = `${summon} ${search}`;
  const leaked: Target = {
    card_types: ['monster'],
    level: { op: 'eq', value: 1 },
    any_of: [{ attributes: ['FIRE'] }, { archetypes: ['Snake-Eye'] }, { archetypes: ['Diabellstar'] }],
  };

  it('drops alternatives printed only in another effect (Original Sinful Spoils - Snake-Eye)', () => {
    const [e] = fixTagEffects(
      [{ snippet: summon, actions: [action({ is_self: false, from_zones: ['hand', 'deck'], target: leaked })], triggers: [] }],
      cardText,
    );
    expect(e!.actions[0]!.target).toEqual({ card_types: ['monster'], level: { op: 'eq', value: 1 }, attributes: ['FIRE'] });
  });

  it('keeps alternatives printed in the effect, and targets where every alternative looks leaked', () => {
    expect(dropLeakedAlternatives(leaked, search, cardText)).toBe(leaked);
    const allLeaked: Target = { any_of: [{ archetypes: ['Snake-Eye'] }, { archetypes: ['Diabellstar'] }] };
    expect(dropLeakedAlternatives(allLeaked, summon, cardText)).toBe(allLeaked);
  });

  it('leaves effects alone without the card text, or when the snippet is not printed as is', () => {
    const effect = { snippet: summon, actions: [action({ is_self: false, target: leaked })], triggers: [] };
    expect(fixTagEffects([effect])[0]).toBe(effect);
    const cut = { ...effect, snippet: 'Send 1 other face-up card you control to the GY; Special Summon 1 Level 1 FIRE monster from your hand or' };
    expect(fixTagEffects([cut], 'Something else entirely.')[0]).toBe(cut);
  });
});

describe('leaked alternatives in a cut-short snippet', () => {
  it('leaves an effect alone when its snippet stops mid-sentence', () => {
    const text = 'When this card is Normal or Special Summoned: You can add 1 "Majespecter" Spell/Trap from your Deck to your hand.';
    const target: Target = { any_of: [{ card_types: ['spell', 'trap'] }, { archetypes: ['Majespecter'] }] };
    const effect = {
      snippet: 'When this card is Normal or Special Summoned: You can add 1 ',
      actions: [action({ verb: 'add_to_hand', is_self: false, target })],
      triggers: [],
    };
    expect(fixTagEffects([effect], `${text} You can only use this effect of "Majespecter Fox - Kyubi" once per turn.`)[0]).toBe(effect);
  });
});

describe('leaked alternatives: what counts as printed', () => {
  it('reads "non-Tuner" as printing Tuner, and ignores missing numbers', () => {
    const text = 'You can Special Summon up to 4 Level 2 non-Tuner monsters from your hand. Cannot be used as Synchro Material.';
    const t: Target = { level: { op: 'eq', value: 2 }, any_of: [{ exclude_monster_kinds: ['tuner'] }, { exclude_monster_kinds: ['synchro'] }] };
    // The non-Tuner alternative stays; "Synchro" is only printed outside the effect.
    expect(dropLeakedAlternatives(t, 'You can Special Summon up to 4 Level 2 non-Tuner monsters from your hand.', text)).toEqual({
      level: { op: 'eq', value: 2 },
      any_of: [{ exclude_monster_kinds: ['tuner'] }],
    });
    const levels: Target = { any_of: [{ level: { op: 'gte', value: 1 } }, { level: { op: 'gte', value: 3 } }] };
    expect(dropLeakedAlternatives(levels, 'Add 1 monster.', 'Add 1 monster. Level 3 or higher.')).toBe(levels);
  });
});
