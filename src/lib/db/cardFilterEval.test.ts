import { describe, expect, it } from 'vitest';
import { evalRuleNode, type CardFilterRow } from './cardFilterEval';
import { defaultRuleTree, type RuleNode } from './cardFilterRule';
import { isStatFilterEmpty, resolveVirtualRuleTree } from './cardFilterResolve';
import { encodeLinkArrowsValue } from './linkArrows';

const row = (partial: Partial<CardFilterRow> & Pick<CardFilterRow, 'id'>): CardFilterRow => ({
  atk: null,
  def: null,
  level: null,
  link_rating: null,
  pend_scale_l: null,
  pend_scale_r: null,
  attribute_id: null,
  species_id: null,
  frame_type_id: null,
  effect_id: null,
  link_arrows: null,
  pendulum_text: null,
  ...partial,
});

describe('cardFilterEval', () => {
  it('matches numeric ATK', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'num', field: 'atk', op: 'gte', value: 3000 },
        },
      ],
    };
    expect(evalRuleNode(row({ id: 1, atk: 3200 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, atk: 1000 }), tree)).toBe(false);
  });

  it('matches attribute cat in', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'cat', field: 'attribute_id', op: 'in', values: [2] },
        },
      ],
    };
    expect(evalRuleNode(row({ id: 1, attribute_id: 2 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, attribute_id: 1 }), tree)).toBe(false);
  });

  it('ATK is ? matches -1', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [{ kind: 'cond', condition: { kind: 'num', field: 'atk', op: 'isQuestion' } }],
    };
    expect(evalRuleNode(row({ id: 1, atk: -1 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, atk: 2500 }), tree)).toBe(false);
    expect(evalRuleNode(row({ id: 3, atk: null }), tree)).toBe(false);
  });

  it('DEF has numeric value excludes ? (-1) and null', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [{ kind: 'cond', condition: { kind: 'num', field: 'def', op: 'notQuestion' } }],
    };
    expect(evalRuleNode(row({ id: 1, def: 0 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, def: -1 }), tree)).toBe(false);
    expect(evalRuleNode(row({ id: 3, def: null }), tree)).toBe(false);
  });

  it('isQuestion on non-ATK/DEF never matches', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [{ kind: 'cond', condition: { kind: 'num', field: 'level', op: 'isQuestion' } }],
    };
    expect(evalRuleNode(row({ id: 1, level: null }), tree)).toBe(false);
  });

  it('matches link_arrows eq exact pattern (S+N → 28)', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'bits', field: 'link_arrows', op: 'eq', values: [2, 8] },
        },
      ],
    };
    expect(evalRuleNode(row({ id: 1, link_arrows: 28 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, link_arrows: 8 }), tree)).toBe(false);
    expect(evalRuleNode(row({ id: 3, link_arrows: 280 }), tree)).toBe(false);
  });

  it('matches link_arrows eq for NW+N+NE → 789', () => {
    const tree: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'bits', field: 'link_arrows', op: 'eq', values: [7, 8, 9] },
        },
      ],
    };
    expect(evalRuleNode(row({ id: 1, link_arrows: 789 }), tree)).toBe(true);
    expect(evalRuleNode(row({ id: 2, link_arrows: 798 }), tree)).toBe(false);
  });
});

describe('linkArrows encoding', () => {
  it('matches S+N and four-corner examples', () => {
    expect(encodeLinkArrowsValue([2, 8])).toBe(28);
    expect(encodeLinkArrowsValue([1, 3, 7, 9])).toBe(1379);
  });

  it('stacks top row as 789 for NW+N+NE', () => {
    expect(encodeLinkArrowsValue([7, 8, 9])).toBe(789);
  });

  it('stacks bottom row as 123 for SW+S+SE', () => {
    expect(encodeLinkArrowsValue([1, 2, 3])).toBe(123);
  });
});

describe('cardFilterResolve', () => {
  it('treats empty rule tree as inactive', () => {
    expect(isStatFilterEmpty(defaultRuleTree())).toBe(true);
  });

  it('resolves card_type spell to frame_type_id 13', () => {
    const root: RuleNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'cat', field: 'card_type', op: 'in', values: [2] },
        },
      ],
    };
    const resolved = resolveVirtualRuleTree(root, []);
    expect(resolved).toEqual({
      kind: 'group',
      logic: 'and',
      children: [
        {
          kind: 'cond',
          condition: { kind: 'cat', field: 'frame_type_id', op: 'in', values: [13] },
        },
      ],
    });
  });
});
