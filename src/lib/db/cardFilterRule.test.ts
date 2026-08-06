import { describe, expect, it } from 'vitest';
import {
  MAX_RULE_DEPTH,
  MAX_RULE_LEAVES,
  countRuleLeaves,
  defaultRuleTree,
  maxRuleDepth,
  ruleNodeSchema,
  validateRuleLimits,
  type RuleNode,
} from './cardFilterRule';

const cond = (field: 'atk' | 'def' = 'atk', value = 1000): RuleNode => ({
  kind: 'cond',
  condition: { kind: 'num', field, op: 'eq', value },
});

const andGroup = (...children: RuleNode[]): RuleNode => ({
  kind: 'group',
  logic: 'and',
  children,
});

describe('defaultRuleTree', () => {
  it('returns an empty AND group', () => {
    expect(defaultRuleTree()).toEqual({ kind: 'group', logic: 'and', children: [] });
  });
});

describe('countRuleLeaves / maxRuleDepth', () => {
  it('counts nested conditions', () => {
    const tree = andGroup(cond('atk'), andGroup(cond('def'), cond('atk', 2000)));
    expect(countRuleLeaves(tree)).toBe(3);
    expect(maxRuleDepth(tree)).toBe(3);
  });

  it('treats empty groups as depth 1', () => {
    expect(maxRuleDepth(defaultRuleTree())).toBe(1);
    expect(countRuleLeaves(defaultRuleTree())).toBe(0);
  });
});

describe('validateRuleLimits', () => {
  it('accepts trees within limits', () => {
    expect(validateRuleLimits(andGroup(cond()))).toEqual({ ok: true });
  });

  it('rejects too many leaves', () => {
    const children = Array.from({ length: MAX_RULE_LEAVES + 1 }, () => cond());
    const result = validateRuleLimits(andGroup(...children));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(String(MAX_RULE_LEAVES));
  });

  it('rejects nesting deeper than MAX_RULE_DEPTH', () => {
    let node: RuleNode = cond();
    for (let i = 0; i < MAX_RULE_DEPTH; i++) {
      node = andGroup(node);
    }
    // depth of a single cond wrapped MAX_RULE_DEPTH times = MAX_RULE_DEPTH + 1
    expect(maxRuleDepth(node)).toBe(MAX_RULE_DEPTH + 1);
    const result = validateRuleLimits(node);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain(String(MAX_RULE_DEPTH));
  });
});

describe('ruleNodeSchema', () => {
  it('parses a valid condition tree', () => {
    const parsed = ruleNodeSchema.parse(
      andGroup({
        kind: 'cond',
        condition: { kind: 'cat', field: 'attribute_id', op: 'in', values: [2] },
      }),
    );
    expect(parsed.kind).toBe('group');
  });

  it('rejects unknown condition kinds', () => {
    expect(() =>
      ruleNodeSchema.parse({
        kind: 'cond',
        condition: { kind: 'weird', field: 'atk', op: 'eq', value: 1 },
      }),
    ).toThrow();
  });
});
