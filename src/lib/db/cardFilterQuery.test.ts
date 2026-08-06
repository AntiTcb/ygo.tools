import { describe, expect, it, vi } from 'vitest';
import { buildOrPart, queryNeuronCardIdsByRule } from './cardFilterQuery';
import { NEURON_ATK_DEF_QUESTION_MARK, type Condition, type RuleNode } from './cardFilterRule';
import type { Database } from './database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

const condTree = (condition: Condition): RuleNode => ({
  kind: 'group',
  logic: 'and',
  children: [{ kind: 'cond', condition }],
});

describe('buildOrPart', () => {
  it('builds numeric comparison fragments', () => {
    expect(buildOrPart(condTree({ kind: 'num', field: 'atk', op: 'gte', value: 2500 }))).toBe('atk.gte.2500');
  });

  it('builds ATK/DEF question-mark fragments', () => {
    expect(buildOrPart(condTree({ kind: 'num', field: 'atk', op: 'isQuestion' }))).toBe(`atk.eq.${NEURON_ATK_DEF_QUESTION_MARK}`);
    expect(buildOrPart(condTree({ kind: 'num', field: 'def', op: 'notQuestion' }))).toBe(
      `and(def.not.is.null,def.neq.${NEURON_ATK_DEF_QUESTION_MARK})`,
    );
  });

  it('builds categorical in/notIn fragments', () => {
    expect(buildOrPart(condTree({ kind: 'cat', field: 'attribute_id', op: 'in', values: [1, 2] }))).toBe('attribute_id.in.(1,2)');
    expect(buildOrPart(condTree({ kind: 'cat', field: 'species_id', op: 'notIn', values: [3] }))).toBe('species_id.not.in.(3)');
  });

  it('builds link_arrows exact match from direction digits', () => {
    expect(buildOrPart(condTree({ kind: 'bits', field: 'link_arrows', op: 'eq', values: [2, 8] }))).toBe('link_arrows.eq.28');
  });

  it('builds pendulum text contains with escaped wildcards', () => {
    expect(buildOrPart(condTree({ kind: 'text', field: 'pendulum_text', op: 'contains', value: 'a*b,c' }))).toBe('pendulum_text.ilike.*a\\*b\\,c*');
  });

  it('nests AND/OR groups', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { kind: 'cond', condition: { kind: 'num', field: 'atk', op: 'eq', value: 0 } },
        {
          kind: 'group',
          logic: 'and',
          children: [
            { kind: 'cond', condition: { kind: 'num', field: 'def', op: 'eq', value: 0 } },
            { kind: 'cond', condition: { kind: 'num', field: 'level', op: 'eq', value: 1 } },
          ],
        },
      ],
    };
    expect(buildOrPart(tree)).toBe('or(atk.eq.0,and(def.eq.0,level.eq.1))');
  });

  it('returns null for incomplete conditions', () => {
    expect(buildOrPart(condTree({ kind: 'num', field: 'atk', op: 'eq' }))).toBeNull();
    expect(buildOrPart(condTree({ kind: 'cat', field: 'attribute_id', op: 'in', values: [] }))).toBeNull();
  });
});

describe('queryNeuronCardIdsByRule', () => {
  it('applies language/limit filters and returns ids', async () => {
    const eq = vi.fn().mockReturnThis();
    const gte = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const from = vi.fn().mockReturnValue({ select });

    const qb = {
      eq,
      gte,
      limit,
      then: (resolve: (v: { data: { id: number }[]; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: [{ id: 11 }, { id: 22 }], error: null })),
    };
    select.mockReturnValue(qb);
    eq.mockReturnValue(qb);
    gte.mockReturnValue(qb);
    limit.mockReturnValue(qb);

    const supabase = { from } as unknown as SupabaseClient<Database>;
    const result = await queryNeuronCardIdsByRule(supabase, condTree({ kind: 'num', field: 'atk', op: 'gte', value: 3000 }));

    expect(from).toHaveBeenCalledWith('neuron_cards');
    expect(select).toHaveBeenCalledWith('id');
    expect(eq).toHaveBeenCalledWith('language', 'en');
    expect(gte).toHaveBeenCalledWith('atk', 3000);
    expect(result).toEqual({ ids: [11, 22], truncated: false });
  });

  it('surfaces query errors', async () => {
    const qb = {
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (v: { data: null; error: { message: string } }) => unknown) =>
        Promise.resolve(resolve({ data: null, error: { message: 'boom' } })),
    };
    const select = vi.fn().mockReturnValue(qb);
    qb.eq.mockReturnValue(qb);
    qb.limit.mockReturnValue(qb);
    const supabase = {
      from: vi.fn().mockReturnValue({ select }),
    } as unknown as SupabaseClient<Database>;

    const result = await queryNeuronCardIdsByRule(supabase, {
      kind: 'group',
      logic: 'and',
      children: [],
    });
    expect(result).toEqual({ ids: [], truncated: false, error: 'boom' });
  });
});
