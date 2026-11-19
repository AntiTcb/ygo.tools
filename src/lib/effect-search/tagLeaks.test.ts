import { describe, expect, it } from 'vitest';
import { actionText, clauses, findLeaks } from './tagLeaks';
import type { TagAction, TagEffect, Target } from './tagSchema';

const action = (verb: string, target: Target | null): TagAction =>
  ({
    verb,
    from_zones: [],
    to_zones: [],
    from_side: null,
    to_side: null,
    is_cost: false,
    is_self: false,
    quantity: 1,
    target,
    name_refs: [],
    contextual: false,
    context_note: null,
    stat: null,
    stat_mode: null,
    stat_amount: null,
    stat_amount_note: null,
  }) as TagAction;

const effect = (snippet: string, actions: TagAction[], effect_index = 0): TagEffect =>
  ({
    text_source: 'card',
    effect_index,
    snippet,
    effect_type: 'ignition',
    opt: 'none',
    phase_restriction: [],
    turn_restriction: 'any',
    triggers: [],
    actions,
  }) as TagEffect;

const leaked: Target = {
  card_types: ['monster'],
  level: { op: 'eq', value: 1 },
  any_of: [{ attributes: ['FIRE'] }, { archetypes: ['Snake-Eye'] }, { archetypes: ['Diabellstar'] }],
};

const summon = 'Send 1 other face-up card you control to the GY; Special Summon 1 Level 1 FIRE monster from your hand or Deck.';
const search =
  'You can banish this card from your GY, then target 1 "Snake-Eye" or "Diabellstar" monster in your GY; add 1 Level 1 FIRE monster from your Deck to your hand, then place the targeted monster on the bottom of the Deck.';
const spoils = `${summon} ${search}`;

describe('findLeaks', () => {
  it('flags values from another effect (Original Sinful Spoils - Snake-Eye)', () => {
    const e = effect(summon, [action('special_summon', leaked)]);
    expect(findLeaks([e], spoils).map((l) => [l.kind, l.value])).toEqual([
      ['other_effect', 'Snake-Eye'],
      ['other_effect', 'Diabellstar'],
    ]);
  });

  it('flags values from another clause of the same effect', () => {
    const e = effect(search, [action('add_to_hand', leaked)], 1);
    expect(findLeaks([e], spoils).map((l) => [l.kind, l.value])).toEqual([
      ['other_clause', 'Snake-Eye'],
      ['other_clause', 'Diabellstar'],
    ]);
  });

  it('accepts restrictions stated in a targeting clause the action refers back to', () => {
    const e = effect('Target 1 Level 4 or lower WATER monster in your GY; Special Summon it.', [
      action('special_summon', { attributes: ['WATER'], level: { op: 'lte', value: 4 } }),
    ]);
    expect(findLeaks([e], e.snippet)).toEqual([]);
  });

  it('skips lists of every possible value', () => {
    const e = effect('Destroy 1 Spell on the field.', [
      action('destroy', { card_types: ['spell'], spell_trap_types: ['normal', 'continuous', 'field', 'equip', 'quick_play', 'ritual'] }),
    ]);
    expect(findLeaks([e], e.snippet)).toEqual([]);
  });

  it('flags values printed nowhere on the card', () => {
    const e = effect('destroy all monsters your opponent controls with an equal or lower Level than it.', [
      action('destroy', { card_types: ['monster'], level: { op: 'lte', value: 0 } }),
    ]);
    expect(findLeaks([e], e.snippet).map((l) => [l.kind, l.field])).toEqual([['unprinted', 'level']]);
  });
});

describe('clauses', () => {
  it('keeps punctuation inside quoted names', () => {
    expect(clauses('Target 1 "T.G." monster; add 1 "Number C39: Utopia Ray" from your Deck to your hand.')).toEqual([
      'Target 1 "T.G." monster',
      'add 1 "Number C39: Utopia Ray" from your Deck to your hand',
    ]);
  });
});

describe('actionText', () => {
  it('is null when no clause names the verb', () => {
    expect(actionText('Target 1 monster; it gains 500 ATK.', 'banish')).toBeNull();
  });
});
