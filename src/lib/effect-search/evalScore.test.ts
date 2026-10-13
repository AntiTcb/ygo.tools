import { describe, expect, it } from 'vitest';
import type { CardFilterRow } from '../db/cardFilterEval';
import { cardPoolTargetComparer, exactTargetComparer, scoreCard, summarize } from './evalScore';
import { tagOutputSchema, type TagOutputInput } from './tagSchema';

const out = (o: TagOutputInput) => tagOutputSchema.parse(o);

const reinforcement = out({
  effects: [
    {
      effect_index: 0,
      snippet: 's',
      effect_type: 'activation',
      actions: [
        { verb: 'add_to_hand', from_zones: ['deck'], from_side: 'you', quantity: 1, target: { level: { op: 'lte', value: 4 }, races: ['Warrior'] } },
      ],
    },
  ],
});

const row = (id: number, level: number, species_id: number): CardFilterRow => ({
  id,
  level,
  species_id,
  atk: 1000,
  def: 1000,
  link_rating: null,
  pend_scale_l: null,
  pend_scale_r: null,
  attribute_id: 1,
  frame_type_id: 1,
  effect_id: 0,
  link_arrows: null,
  pendulum_text: null,
});
const pool = [row(1, 3, 15), row(2, 4, 15), row(3, 5, 15), row(4, 4, 11)];
const complex = [{ id: 1, subtype_1: 1, subtype_2: null, subtype_3: null }];
const cmp = cardPoolTargetComparer(pool, complex, () => undefined);

describe('cardPoolTargetComparer', () => {
  it('treats equivalent targets as identical and scores overlap otherwise', () => {
    expect(cmp({ level: { op: 'lte', value: 4 } }, { level: { op: 'lt', value: 5 } })).toBe(1);
    // {1,2} vs {1,2,3}
    expect(cmp({ level: { op: 'lte', value: 4 }, races: ['Warrior'] }, { races: ['Warrior'] })).toBeCloseTo(2 / 3);
    expect(cmp(null, { level: { op: 'gte', value: 0 } })).toBe(1);
    expect(cmp(null, { races: ['Warrior'] })).toBe(0);
  });
});

describe('scoreCard', () => {
  it('scores a perfect prediction as 1', () => {
    const s = scoreCard(reinforcement, reinforcement, cmp);
    expect(s.score).toBe(1);
    expect(s.notes).toEqual([]);
    expect(s.triggersF1).toBeNull();
  });

  it('reports field disagreements, missing/extra actions and effect-level differences', () => {
    const predicted = out({
      effects: [
        {
          effect_index: 0,
          snippet: 's',
          effect_type: 'ignition',
          actions: [
            { verb: 'add_to_hand', from_zones: ['deck', 'gy'], from_side: 'you', quantity: 1, target: { races: ['Warrior'] } },
            { verb: 'draw', quantity: 1 },
          ],
        },
      ],
      unmapped: [{ kind: 'verb', proposed_term: 'x', phrase: 'p' }],
    });
    const s = scoreCard(reinforcement, predicted, cmp);
    expect(s.effectsF1).toBe(1);
    expect(s.effectFields).toBe(0.75);
    expect(s.actionsF1).toBeCloseTo(2 / 3);
    expect(s.fieldErrors['action.from_zones']).toBeCloseTo(0.5);
    expect(s.fieldErrors['action.target']).toBeCloseTo(1 / 3);
    expect(s.notes).toEqual([
      'effect card:0 effect_type: expected "activation", got "ignition"',
      'effect card:0 add_to_hand: from_zones, target differ',
      'effect card:0: extra action draw',
      'unmapped: expected 0, got 1',
    ]);
    expect(s.score).toBeLessThan(1);
  });

  it('counts actions of missing effects as missed', () => {
    const s = scoreCard(reinforcement, out({ effects: [] }), exactTargetComparer);
    expect(s).toMatchObject({ effectsF1: 0, actionsF1: 0 });
  });
});

describe('summarize', () => {
  it('counts failed cards as 0 and aggregates field errors', () => {
    const perfect = scoreCard(reinforcement, reinforcement, cmp);
    const sum = summarize([perfect, null]);
    expect(sum).toMatchObject({ cards: 2, failed: 1, score: 0.5, actionsF1: 1 });
    expect(sum.topFieldErrors).toEqual([]);
  });
});
