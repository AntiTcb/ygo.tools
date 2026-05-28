import { getRequestEvent, query } from '$app/server';
import { queryNeuronCardIdsByRule } from '$lib/db/cardFilterQuery';
import { ruleNodeSchema, validateRuleLimits, type RuleNode } from '$lib/db/cardFilterRule';

const hasVirtualCat = (node: RuleNode): boolean => {
  if (node.kind === 'cond' && node.condition.kind === 'cat') {
    const f = node.condition.field;
    return f === 'card_type' || f === 'frame_subtype';
  }
  return node.kind === 'group' && node.children.some(hasVirtualCat);
};

export const filterNeuronCardIds = query(
  ruleNodeSchema,
  async (tree): Promise<{ ids: number[]; truncated: boolean; error?: string }> => {
    if (hasVirtualCat(tree)) {
      return { ids: [], truncated: false, error: 'Virtual filter fields must be resolved client-side' };
    }
    const lim = validateRuleLimits(tree);
    if (!lim.ok) {
      return { ids: [], truncated: false, error: lim.message };
    }
    const { locals } = getRequestEvent();
    return queryNeuronCardIdsByRule(locals.supabase, tree);
  },
);
