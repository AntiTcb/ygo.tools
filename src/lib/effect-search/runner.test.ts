import { describe, expect, it } from 'vitest';
import { buildClusterPrompt, parseClusterReply } from './runner';

describe('suggestion clustering', () => {
  const items = [
    { id: 1, kind: 'verb' as const, proposed_term: 'fusion_substitute', description: 'substitute for a material', phrases: ['substitute this card'] },
    { id: 2, kind: 'verb' as const, proposed_term: 'fusion_material_substitute', description: null, phrases: [] },
  ];

  it('lists proposals with existing terms and known clusters', () => {
    const prompt = buildClusterPrompt(items, ['send_to_gy', 'banish'], ['negate_attack']);
    expect(prompt).toContain('Existing terms: send_to_gy, banish');
    expect(prompt).toContain('Known clusters: negate_attack');
    expect(prompt).toContain('1 | verb | fusion_substitute | substitute for a material | substitute this card');
    expect(prompt).toContain('2 | verb | fusion_material_substitute |  | ');
  });

  it('keeps only assignments for the chunk, normalised to snake_case', () => {
    const reply = JSON.stringify({
      assignments: [
        { id: 1, cluster: 'Fusion Substitute' },
        { id: 2, cluster: 'fusion_substitute' },
        { id: 99, cluster: 'stray' },
        { id: 1, cluster: '!!!' },
        { id: 'x', cluster: 'bad' },
      ],
    });
    expect([...parseClusterReply(reply, [1, 2])]).toEqual([
      [1, 'fusion_substitute'],
      [2, 'fusion_substitute'],
    ]);
    expect(parseClusterReply('```json\n{"assignments":[]}\n```', [1]).size).toBe(0);
    expect(() => parseClusterReply('nope', [1])).toThrow();
  });
});
