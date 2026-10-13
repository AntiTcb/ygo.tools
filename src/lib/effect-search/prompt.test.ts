import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, type PromptVocab } from './prompt';
import { buildTagJsonSchema } from './tagJsonSchema';
import { tagOutputSchema, validateTagOutput, type Vocab } from './tagSchema';
import { EFFECT_ACTION_VERBS, EFFECT_EVENT_VERBS, EFFECT_ZONES } from './vocab.generated';

const vocab: Vocab = { actionVerbs: EFFECT_ACTION_VERBS, eventVerbs: EFFECT_EVENT_VERBS, zones: EFFECT_ZONES };

const promptVocab: PromptVocab = {
  verbs: [...new Set([...EFFECT_ACTION_VERBS, ...EFFECT_EVENT_VERBS])].map((term) => ({
    term,
    description: `desc of ${term}`,
    usable_as_action: (EFFECT_ACTION_VERBS as readonly string[]).includes(term),
    usable_as_event: (EFFECT_EVENT_VERBS as readonly string[]).includes(term),
  })),
  zones: EFFECT_ZONES.map((term) => ({ term, description: `desc of ${term}` })),
};

/** Pulls the example outputs back out of the rendered prompt, so they are checked exactly as the model sees them. */
const exampleOutputs = (prompt: string) =>
  prompt
    .split('\n')
    .map((line, i, lines) => (lines[i - 1] === 'Output:' ? line : null))
    .filter((l): l is string => l !== null)
    .map((l) => JSON.parse(l) as unknown);

describe('tagger prompt', () => {
  const prompt = buildSystemPrompt(promptVocab);

  it('lists the vocabulary by role', () => {
    expect(prompt).toContain('- special_summon: desc of special_summon');
    const events = prompt.slice(prompt.indexOf('Event verbs'), prompt.indexOf('Zones:'));
    expect(events).toContain('- summoned:');
    expect(events).not.toContain('- reveal:');
  });

  it('has worked examples that are valid tagger output for the seeded vocabulary', () => {
    const outputs = exampleOutputs(prompt);
    expect(outputs.length).toBe(4);
    for (const raw of outputs) {
      const parsed = tagOutputSchema.parse(raw);
      expect(validateTagOutput(parsed, vocab)).toEqual([]);
    }
  });

  it('renders the user prompt with pendulum text only when present', () => {
    const base = { name: 'X', typeLine: 'Normal Spell', effectText: 'Draw 2 cards.', pendulumText: null };
    expect(buildUserPrompt(base)).not.toContain('Pendulum');
    expect(buildUserPrompt({ ...base, pendulumText: 'Scale effect.' })).toContain('Pendulum Effect text:\nScale effect.');
  });
});

describe('buildTagJsonSchema', () => {
  it('narrows verbs, events and zones to the vocabulary', () => {
    const json = JSON.stringify(buildTagJsonSchema(vocab));
    expect(json).toContain(JSON.stringify([...EFFECT_ACTION_VERBS]));
    expect(json).toContain(JSON.stringify([...EFFECT_EVENT_VERBS]));
    expect(json).toContain(JSON.stringify([...EFFECT_ZONES]));
    expect(json).not.toContain('$schema');
  });
});

describe('validateTagOutput', () => {
  it('flags unknown terms and inconsistent fields', () => {
    const out = tagOutputSchema.parse({
      effects: [
        {
          effect_index: 0,
          snippet: 's',
          effect_type: 'ignition',
          triggers: [{ event: 'reveal', subject_is_self: true, subject: { card_types: ['monster'] } }],
          actions: [{ verb: 'summoned', from_zones: ['moon'], stat_mode: 'gain' }],
        },
        { effect_index: 0, snippet: 's', effect_type: 'ignition' },
      ],
    });
    expect(validateTagOutput(out, vocab)).toEqual([
      'effects[0].triggers[0]: "reveal" is not an event verb',
      'effects[0].triggers[0]: subject_is_self with a subject',
      'effects[0].actions[0]: "summoned" is not an action verb',
      'effects[0].actions[0]: unknown zone "moon"',
      'effects[0].actions[0]: stat and stat_mode must be set together',
      'effects[1]: duplicate card effect_index 0 (effects from the Pendulum Effect text need "text_source": "pendulum" and their own numbering from 0)',
    ]);
  });

  it('allows amounts on LP/damage actions but not on other verbs without a stat', () => {
    const out = tagOutputSchema.parse({
      effects: [
        {
          effect_index: 0,
          snippet: 's',
          effect_type: 'activation',
          actions: [
            { verb: 'lose_lp', is_cost: true, stat_amount_note: 'half your LP' },
            { verb: 'inflict_damage', stat_amount: 800 },
            { verb: 'draw', stat_amount: 2 },
          ],
        },
      ],
    });
    expect(validateTagOutput(out, vocab)).toEqual([
      'effects[0].actions[2]: stat_amount is only for change_stats (with stat) and inflict_damage/gain_lp/lose_lp',
    ]);
  });
});

describe('buildTagJsonSchema text_source', () => {
  it('requires text_source on effects so Pendulum effects are labelled explicitly', () => {
    const schema = buildTagJsonSchema(vocab) as { properties: { effects: { items: { required: string[] } } } };
    expect(schema.properties.effects.items.required).toContain('text_source');
  });
});
