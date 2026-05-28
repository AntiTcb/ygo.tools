import {
  SPELL_FRAME_TYPE_ID,
  TRAP_FRAME_TYPE_ID,
  type ComplexFrameTypeRow,
  type RuleNode,
} from './cardFilterRule';

const impossible: RuleNode = {
  kind: 'group',
  logic: 'and',
  children: [
    { kind: 'cond', condition: { kind: 'num', field: 'id', op: 'eq', value: -1 } },
    { kind: 'cond', condition: { kind: 'num', field: 'id', op: 'eq', value: -2 } },
  ],
};

const tautology: RuleNode = {
  kind: 'group',
  logic: 'or',
  children: [
    { kind: 'cond', condition: { kind: 'num', field: 'id', op: 'gte', value: 0 } },
    { kind: 'cond', condition: { kind: 'num', field: 'id', op: 'lt', value: 0 } },
  ],
};

const complexIdsForSubtypes = (subtypeIds: number[], rows: ComplexFrameTypeRow[]): number[] => {
  const want = new Set(subtypeIds);
  const out = new Set<number>();
  for (const row of rows) {
    const subs = [row.subtype_1, row.subtype_2, row.subtype_3].filter(
      (x): x is number => x !== null && x !== undefined,
    );
    if (subs.some((s) => want.has(s))) out.add(row.id);
  }
  return [...out];
};

const cardTypePredicate = (cardTypeId: number): RuleNode => {
  if (cardTypeId === 1) {
    return {
      kind: 'cond',
      condition: {
        kind: 'cat',
        field: 'frame_type_id',
        op: 'notIn',
        values: [SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID],
      },
    };
  }
  if (cardTypeId === 2) {
    return {
      kind: 'cond',
      condition: { kind: 'cat', field: 'frame_type_id', op: 'in', values: [SPELL_FRAME_TYPE_ID] },
    };
  }
  if (cardTypeId === 3) {
    return {
      kind: 'cond',
      condition: { kind: 'cat', field: 'frame_type_id', op: 'in', values: [TRAP_FRAME_TYPE_ID] },
    };
  }
  return impossible;
};

const expandCardType = (op: 'in' | 'notIn', values: number[]): RuleNode => {
  const uniq = [...new Set(values)].filter((id) => id >= 1 && id <= 3);
  if (uniq.length === 0) return op === 'in' ? impossible : tautology;

  const preds = uniq.map(cardTypePredicate);
  if (op === 'in') {
    if (preds.length === 1) return preds[0]!;
    return { kind: 'group', logic: 'or', children: preds };
  }

  const negPreds = preds.map(negatePredicate);
  if (negPreds.length === 1) return negPreds[0]!;
  return { kind: 'group', logic: 'and', children: negPreds };
};

const negatePredicate = (node: RuleNode): RuleNode => {
  if (node.kind !== 'cond') {
    return {
      kind: 'group',
      logic: 'or',
      children: [node, impossible],
    };
  }
  const c = node.condition;
  if (c.kind === 'cat' && c.field === 'frame_type_id') {
    if (c.op === 'in' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'notIn', values: c.values } };
    }
    if (c.op === 'notIn' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'in', values: c.values } };
    }
    if (c.op === 'isNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'notNull' } };
    }
    if (c.op === 'notNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'isNull' } };
    }
  }
  if (c.kind === 'cat' && c.field === 'attribute_id') {
    if (c.op === 'in' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'attribute_id', op: 'notIn', values: c.values } };
    }
    if (c.op === 'notIn' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'attribute_id', op: 'in', values: c.values } };
    }
    if (c.op === 'isNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'attribute_id', op: 'notNull' } };
    }
    if (c.op === 'notNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'attribute_id', op: 'isNull' } };
    }
  }
  if (c.kind === 'cat' && c.field === 'species_id') {
    if (c.op === 'in' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'species_id', op: 'notIn', values: c.values } };
    }
    if (c.op === 'notIn' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'species_id', op: 'in', values: c.values } };
    }
    if (c.op === 'isNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'species_id', op: 'notNull' } };
    }
    if (c.op === 'notNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'species_id', op: 'isNull' } };
    }
  }
  if (c.kind === 'cat' && c.field === 'effect_id') {
    if (c.op === 'in' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'effect_id', op: 'notIn', values: c.values } };
    }
    if (c.op === 'notIn' && c.values?.length) {
      return { kind: 'cond', condition: { kind: 'cat', field: 'effect_id', op: 'in', values: c.values } };
    }
    if (c.op === 'isNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'effect_id', op: 'notNull' } };
    }
    if (c.op === 'notNull') {
      return { kind: 'cond', condition: { kind: 'cat', field: 'effect_id', op: 'isNull' } };
    }
  }
  return {
    kind: 'group',
    logic: 'or',
    children: [node, impossible],
  };
};

const expandFrameSubtype = (op: 'in' | 'notIn', values: number[], complexRows: ComplexFrameTypeRow[]): RuleNode => {
  const uniq = [...new Set(values)];
  const ids = complexIdsForSubtypes(uniq, complexRows);
  if (op === 'in') {
    if (ids.length === 0) return impossible;
    return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'in', values: ids } };
  }
  if (ids.length === 0) return tautology;
  return { kind: 'cond', condition: { kind: 'cat', field: 'frame_type_id', op: 'notIn', values: ids } };
};

const resolveNode = (node: RuleNode, complexRows: ComplexFrameTypeRow[]): RuleNode => {
  if (node.kind === 'group') {
    return {
      kind: 'group',
      logic: node.logic,
      children: node.children.map((ch) => resolveNode(ch, complexRows)),
    };
  }

  const c = node.condition;
  if (c.kind === 'cat' && c.field === 'card_type') {
    const vals = c.values ?? [];
    if (c.op === 'in' || c.op === 'notIn') return expandCardType(c.op, vals);
    if (c.op === 'isNull') {
      return {
        kind: 'cond',
        condition: {
          kind: 'cat',
          field: 'frame_type_id',
          op: 'isNull',
        },
      };
    }
    if (c.op === 'notNull') {
      return {
        kind: 'cond',
        condition: {
          kind: 'cat',
          field: 'frame_type_id',
          op: 'notNull',
        },
      };
    }
  }

  if (c.kind === 'cat' && c.field === 'frame_subtype') {
    const vals = c.values ?? [];
    if (c.op === 'in' || c.op === 'notIn') return expandFrameSubtype(c.op, vals, complexRows);
    return node;
  }

  return node;
};

export const resolveVirtualRuleTree = (root: RuleNode, complexRows: ComplexFrameTypeRow[]): RuleNode =>
  resolveNode(root, complexRows);

export const isStatFilterEmpty = (node: RuleNode): boolean => {
  if (node.kind === 'cond') return false;
  if (node.children.length === 0) return true;
  return node.children.every((ch) => isStatFilterEmpty(ch));
};

/** Reserved: true if some resolved rule cannot be expressed in `queryNeuronCardIdsByRule` and must use `evalRuleNode` on loaded rows. */
export const treeNeedsClientEval = (_node: RuleNode): boolean => false;
