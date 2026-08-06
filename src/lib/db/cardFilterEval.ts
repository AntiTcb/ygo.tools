import type { Condition, RuleNode } from './cardFilterRule';
import { NEURON_ATK_DEF_QUESTION_MARK } from './cardFilterRule';
import { encodeLinkArrowsValue } from './linkArrows';

/** Minimal row shape for evaluating rules client- or server-side */
export type CardFilterRow = {
  id: number;
  atk: number | null;
  def: number | null;
  level: number | null;
  link_rating: number | null;
  pend_scale_l: number | null;
  pend_scale_r: number | null;
  attribute_id: number | null;
  species_id: number | null;
  frame_type_id: number | null;
  effect_id: number | null;
  link_arrows: number | null;
  pendulum_text: string | null;
};

const colNum = (row: CardFilterRow, field: Condition & { kind: 'num' }): number | null => {
  switch (field.field) {
    case 'atk':
      return row.atk;
    case 'def':
      return row.def;
    case 'level':
      return row.level;
    case 'link_rating':
      return row.link_rating;
    case 'pend_scale_l':
      return row.pend_scale_l;
    case 'pend_scale_r':
      return row.pend_scale_r;
    case 'id':
      return row.id;
    default:
      return null;
  }
};

const evalNum = (row: CardFilterRow, c: Extract<Condition, { kind: 'num' }>): boolean => {
  const v = colNum(row, c);
  const atkOrDef = c.field === 'atk' || c.field === 'def';
  switch (c.op) {
    case 'isQuestion':
      return atkOrDef && v === NEURON_ATK_DEF_QUESTION_MARK;
    case 'notQuestion':
      return atkOrDef && v !== null && v !== NEURON_ATK_DEF_QUESTION_MARK;
    case 'isNull':
      return v === null;
    case 'notNull':
      return v !== null;
    case 'eq':
      return v === c.value!;
    case 'neq':
      return v !== c.value!;
    case 'gt':
      return v !== null && v > c.value!;
    case 'gte':
      return v !== null && v >= c.value!;
    case 'lt':
      return v !== null && v < c.value!;
    case 'lte':
      return v !== null && v <= c.value!;
    default:
      return false;
  }
};

const evalCat = (row: CardFilterRow, c: Extract<Condition, { kind: 'cat' }>): boolean => {
  let col: number | null;
  switch (c.field) {
    case 'attribute_id':
      col = row.attribute_id;
      break;
    case 'species_id':
      col = row.species_id;
      break;
    case 'frame_type_id':
      col = row.frame_type_id;
      break;
    case 'effect_id':
      col = row.effect_id;
      break;
    default:
      return false;
  }

  switch (c.op) {
    case 'isNull':
      return col === null;
    case 'notNull':
      return col !== null;
    case 'in':
      return col !== null && (c.values?.includes(col) ?? false);
    case 'notIn':
      return col === null || !(c.values?.includes(col) ?? false);
    default:
      return false;
  }
};

const evalBits = (row: CardFilterRow, c: Extract<Condition, { kind: 'bits' }>): boolean => {
  const v = row.link_arrows;
  if (c.op === 'isNull') return v === null;
  if (c.op !== 'eq' || v === null) return false;

  const digits = c.values ?? [];
  if (digits.length === 0) return false;

  return v === encodeLinkArrowsValue(digits);
};

const evalText = (row: CardFilterRow, c: Extract<Condition, { kind: 'text' }>): boolean => {
  const t = row.pendulum_text ?? '';
  switch (c.op) {
    case 'isNull':
      return row.pendulum_text === null;
    case 'notNull':
      return row.pendulum_text !== null;
    case 'contains':
      return c.value !== undefined && t.includes(c.value);
    case 'eq':
      return c.value !== undefined && t === c.value;
    default:
      return false;
  }
};

const evalCond = (row: CardFilterRow, c: Condition): boolean => {
  if (c.kind === 'num') return evalNum(row, c);
  if (c.kind === 'cat') return evalCat(row, c);
  if (c.kind === 'bits') return evalBits(row, c);
  if (c.kind === 'text') return evalText(row, c);
  return false;
};

export const evalRuleNode = (row: CardFilterRow, node: RuleNode): boolean => {
  if (node.kind === 'cond') return evalCond(row, node.condition);
  if (node.children.length === 0) return true;
  if (node.logic === 'and') return node.children.every((ch) => evalRuleNode(row, ch));
  return node.children.some((ch) => evalRuleNode(row, ch));
};

export const filterRowsByRule = (rows: CardFilterRow[], root: RuleNode): CardFilterRow[] => rows.filter((row) => evalRuleNode(row, root));
