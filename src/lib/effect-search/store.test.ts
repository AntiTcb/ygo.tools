import { describe, expect, it } from 'vitest';
import { buildNameIndex, currentCardName, makeNameResolver, projectTagOutput } from './store';
import { tagOutputSchema } from './tagSchema';

const index = buildNameIndex([
  { id: 1, name: 'Toadally Awesome' },
  { id: 2, name: 'Slime Toad (Updated from: Frog the Jam)' },
  { id: 3, name: 'Twin Name' },
  { id: 4, name: 'Twin Name' },
]);

describe('name resolution', () => {
  it('strips Neuron rename suffixes', () => {
    expect(currentCardName('Slime Toad (Updated from: Frog the Jam)')).toBe('Slime Toad');
  });

  it('matches exact names, falls back to case-insensitive, prefers related cards', () => {
    expect(makeNameResolver(index)('Toadally Awesome')).toBe(1);
    expect(makeNameResolver(index)('toadally awesome')).toBe(1);
    expect(makeNameResolver(index)('Slime Toad')).toBe(2);
    expect(makeNameResolver(index)('Frog the Jam')).toBeUndefined();
    expect(makeNameResolver(index)('Twin Name')).toBe(3);
    expect(makeNameResolver(index, new Set([4]))('Twin Name')).toBe(4);
  });
});

describe('projectTagOutput', () => {
  it('compiles targets, resolves name_refs and reports unresolved names', () => {
    const out = tagOutputSchema.parse({
      effects: [
        {
          effect_index: 0,
          snippet: 's',
          effect_type: 'ignition',
          triggers: [{ event: 'send_to_gy', cause: 'cost', cause_card: { attributes: ['WATER'] } }],
          actions: [
            { verb: 'special_summon', from_zones: ['gy'], name_refs: ['Toadally Awesome', 'Ghost Card'] },
            { verb: 'add_to_hand', target: { names: ['Slime Toad', 'Other Ghost'] } },
          ],
        },
      ],
    });
    const [effect] = projectTagOutput(out, makeNameResolver(index));
    expect(effect!.actions[0]).toMatchObject({ name_refs: [1], unresolved_name_refs: ['Ghost Card'], target: null, target_rule: null });
    expect(effect!.actions[1]!.unresolved_name_refs).toEqual(['Other Ghost']);
    expect(effect!.actions[1]!.target_rule).toEqual({ kind: 'cond', condition: { kind: 'num', field: 'id', op: 'eq', value: 2 } });
    expect(effect!.triggers[0]!.cause_card_rule).toEqual({ kind: 'cond', condition: { kind: 'cat', field: 'attribute_id', op: 'in', values: [3] } });
    expect(effect!.triggers[0]).toMatchObject({ subject_is_self: false, subject_rule: null, cause: 'cost' });
  });
});
