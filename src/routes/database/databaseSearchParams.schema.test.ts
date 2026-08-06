import { describe, expect, it } from 'vitest';
import { defaultRuleTree } from '$lib/db/cardFilterRule';
import { databaseSearchParamsSchema } from './databaseSearchParams.schema';

describe('databaseSearchParamsSchema', () => {
  it('fills defaults for an empty object', () => {
    const parsed = databaseSearchParamsSchema.parse({});
    expect(parsed.name).toBe('');
    expect(parsed.effectText).toBe('');
    expect(parsed.pendulumText).toBe('');
    expect(parsed.regexEffectSearch).toBe(false);
    expect(parsed.regexPendulumSearch).toBe(false);
    expect(parsed.regexEffectFlags).toBe('');
    expect(parsed.regexPendulumFlags).toBe('');
    expect(parsed.hideEffectText).toBe(false);
    expect(parsed.ruleDraft).toEqual(defaultRuleTree());
    expect(parsed.ruleApplied).toEqual(defaultRuleTree());
  });

  it('accepts populated search state', () => {
    const rule = {
      kind: 'group' as const,
      logic: 'and' as const,
      children: [
        {
          kind: 'cond' as const,
          condition: { kind: 'cat' as const, field: 'attribute_id' as const, op: 'in' as const, values: [2] },
        },
      ],
    };
    const parsed = databaseSearchParamsSchema.parse({
      name: 'Blue',
      effectText: 'destroy',
      pendulumText: 'scale',
      regexEffectSearch: true,
      regexPendulumSearch: false,
      regexEffectFlags: 'i',
      regexPendulumFlags: '',
      hideEffectText: true,
      ruleDraft: rule,
      ruleApplied: rule,
    });
    expect(parsed.name).toBe('Blue');
    expect(parsed.regexEffectSearch).toBe(true);
    expect(parsed.hideEffectText).toBe(true);
    expect(parsed.ruleApplied).toEqual(rule);
  });

  it('rejects invalid rule trees', () => {
    expect(() =>
      databaseSearchParamsSchema.parse({
        ruleDraft: { kind: 'group', logic: 'xor', children: [] },
      }),
    ).toThrow();
  });
});
