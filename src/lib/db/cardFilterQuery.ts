import type { PostgrestFilterBuilder, SupabaseClient } from '@supabase/supabase-js';
import { NEURON_ATK_DEF_QUESTION_MARK, REMOTE_FETCH_LIMIT, type Condition, type RuleNode } from './cardFilterRule';
import type { Database } from './database.types';
import { encodeLinkArrowsValue } from './linkArrows';

type Db = SupabaseClient<Database>;

type NeuronCardsRow = Database['public']['Tables']['neuron_cards']['Row'];
type NeuronCardsRelationships = Database['public']['Tables']['neuron_cards']['Relationships'];

type Qb = PostgrestFilterBuilder<
  {},
  Database['public'],
  NeuronCardsRow,
  Pick<NeuronCardsRow, 'id'>[],
  'neuron_cards',
  NeuronCardsRelationships,
  'GET'
>;

const buildCondString = (c: Condition): string | null => {
  if (c.kind === 'num') {
    const col = c.field;
    switch (c.op) {
      case 'eq':
        return c.value === undefined ? null : `${col}.eq.${c.value}`;
      case 'neq':
        return c.value === undefined ? null : `${col}.neq.${c.value}`;
      case 'gt':
        return c.value === undefined ? null : `${col}.gt.${c.value}`;
      case 'gte':
        return c.value === undefined ? null : `${col}.gte.${c.value}`;
      case 'lt':
        return c.value === undefined ? null : `${col}.lt.${c.value}`;
      case 'lte':
        return c.value === undefined ? null : `${col}.lte.${c.value}`;
      case 'isNull':
        return `${col}.is.null`;
      case 'notNull':
        return `${col}.not.is.null`;
      case 'isQuestion':
        return col === 'atk' || col === 'def' ? `${col}.eq.${NEURON_ATK_DEF_QUESTION_MARK}` : null;
      case 'notQuestion':
        return col === 'atk' || col === 'def' ? `and(${col}.not.is.null,${col}.neq.${NEURON_ATK_DEF_QUESTION_MARK})` : null;
      default:
        return null;
    }
  }

  if (c.kind === 'cat') {
    const col = c.field;
    switch (c.op) {
      case 'in': {
        if (!c.values?.length) return null;
        return `${col}.in.(${c.values.join(',')})`;
      }
      case 'notIn': {
        if (!c.values?.length) return null;
        return `${col}.not.in.(${c.values.join(',')})`;
      }
      case 'isNull':
        return `${col}.is.null`;
      case 'notNull':
        return `${col}.not.is.null`;
      default:
        return null;
    }
  }

  if (c.kind === 'bits') {
    if (c.op === 'isNull') return `link_arrows.is.null`;
    if (c.op === 'eq') {
      const digits = c.values ?? [];
      if (digits.length === 0) return null;
      const n = encodeLinkArrowsValue(digits);
      return `link_arrows.eq.${n}`;
    }
    return null;
  }

  if (c.kind === 'text') {
    const col = c.field;
    switch (c.op) {
      case 'contains': {
        if (c.value === undefined || c.value === '') return null;
        const esc = c.value.replaceAll('\\', '\\\\').replaceAll('*', '\\*').replaceAll(',', '\\,');
        return `${col}.ilike.*${esc}*`;
      }
      case 'eq': {
        if (c.value === undefined) return null;
        const esc = String(c.value).replaceAll('"', '\\"');
        return `${col}.eq."${esc}"`;
      }
      case 'isNull':
        return `${col}.is.null`;
      case 'notNull':
        return `${col}.not.is.null`;
      default:
        return null;
    }
  }

  return null;
};

/** PostgREST `or`/`and` filter fragment for a rule node (exported for unit tests). */
export const buildOrPart = (node: RuleNode): string | null => {
  if (node.kind === 'cond') return buildCondString(node.condition);
  if (node.kind === 'group' && node.logic === 'and') {
    const ps = node.children.map(buildOrPart).filter((x): x is string => Boolean(x));
    if (ps.length === 0) return null;
    if (ps.length === 1) return ps[0]!;
    return `and(${ps.join(',')})`;
  }
  if (node.kind === 'group' && node.logic === 'or') {
    const ps = node.children.map(buildOrPart).filter((x): x is string => Boolean(x));
    if (ps.length === 0) return null;
    if (ps.length === 1) return ps[0]!;
    return `or(${ps.join(',')})`;
  }
  return null;
};

const applyCond = (q: Qb, c: Condition): Qb => {
  if (c.kind === 'num') {
    const col = c.field;
    switch (c.op) {
      case 'eq':
        return c.value === undefined ? q : q.eq(col, c.value);
      case 'neq':
        return c.value === undefined ? q : q.neq(col, c.value);
      case 'gt':
        return c.value === undefined ? q : q.gt(col, c.value);
      case 'gte':
        return c.value === undefined ? q : q.gte(col, c.value);
      case 'lt':
        return c.value === undefined ? q : q.lt(col, c.value);
      case 'lte':
        return c.value === undefined ? q : q.lte(col, c.value);
      case 'isNull':
        return q.is(col, null);
      case 'notNull':
        return q.not(col, 'is', null);
      case 'isQuestion':
        return c.field === 'atk' || c.field === 'def' ? q.eq(col, NEURON_ATK_DEF_QUESTION_MARK) : q;
      case 'notQuestion':
        return c.field === 'atk' || c.field === 'def' ? q.not(col, 'is', null).neq(col, NEURON_ATK_DEF_QUESTION_MARK) : q;
      default:
        return q;
    }
  }

  if (c.kind === 'cat') {
    if (c.field === 'card_type' || c.field === 'frame_subtype') return q;
    const col = c.field;
    switch (c.op) {
      case 'in':
        return c.values?.length ? q.in(col, c.values) : q;
      case 'notIn':
        return c.values?.length ? q.notIn(col, c.values) : q;
      case 'isNull':
        return q.is(col, null);
      case 'notNull':
        return q.not(col, 'is', null);
      default:
        return q;
    }
  }

  if (c.kind === 'bits') {
    if (c.op === 'isNull') return q.is('link_arrows', null);
    if (c.op === 'eq') {
      const digits = c.values ?? [];
      if (digits.length === 0) return q;
      return q.eq('link_arrows', encodeLinkArrowsValue(digits));
    }
    return q;
  }

  if (c.kind === 'text') {
    const col = c.field;
    switch (c.op) {
      case 'contains':
        return c.value === undefined || c.value === '' ? q : q.ilike(col, `%${c.value}%`);
      case 'eq':
        return c.value === undefined ? q : q.eq(col, c.value);
      case 'isNull':
        return q.is(col, null);
      case 'notNull':
        return q.not(col, 'is', null);
      default:
        return q;
    }
  }

  return q;
};

const applyRuleToQuery = (q: Qb, node: RuleNode): Qb => {
  if (node.kind === 'cond') return applyCond(q, node.condition);
  if (node.kind === 'group' && node.logic === 'and') {
    return node.children.reduce((acc, ch) => applyRuleToQuery(acc, ch), q);
  }
  if (node.kind === 'group' && node.logic === 'or') {
    const parts = node.children.map(buildOrPart).filter((x): x is string => Boolean(x));
    if (parts.length === 0) return q;
    return q.or(parts.join(','));
  }
  return q;
};

export const queryNeuronCardIdsByRule = async (supabase: Db, root: RuleNode): Promise<{ ids: number[]; truncated: boolean; error?: string }> => {
  let q: Qb = supabase.from('neuron_cards').select('id').eq('language', 'en').limit(REMOTE_FETCH_LIMIT);

  q = applyRuleToQuery(q, root);

  const { data, error } = await q;

  if (error) {
    console.error('[filterCards] query error', error);
    return { ids: [], truncated: false, error: error.message };
  }

  const raw = (data ?? []).map((r: { id: number }) => r.id);
  return { ids: raw, truncated: false };
};
