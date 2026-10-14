import { describe, expect, it } from 'vitest';
import gold from '../../../scripts/effect-search/gold.json';
import { TAG_EXAMPLES } from './prompt';
import { tagOutputSchema, validateTagOutput, type Vocab } from './tagSchema';
import { EFFECT_ACTION_VERBS, EFFECT_EVENT_VERBS, EFFECT_ZONES } from './vocab.generated';

const vocab: Vocab = { actionVerbs: EFFECT_ACTION_VERBS, eventVerbs: EFFECT_EVENT_VERBS, zones: EFFECT_ZONES };

describe('gold set seed', () => {
  it('has unique cards, none of which are prompt examples (they would score trivially)', () => {
    const ids = gold.map((g) => g.card_id);
    expect(new Set(ids).size).toBe(ids.length);
    const exampleNames = new Set(TAG_EXAMPLES.map((e) => e.card.name));
    expect(gold.filter((g) => exampleNames.has(g.name)).map((g) => g.name)).toEqual([]);
  });

  it.each(gold.map((g) => [g.name, g] as const))('%s is valid tagger output', (_name, g) => {
    const parsed = tagOutputSchema.parse(g.expected);
    expect(validateTagOutput(parsed, vocab)).toEqual([]);
  });
});
