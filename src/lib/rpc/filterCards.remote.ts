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

/** `archetype` needs a `card_archetypes` lookup that the PostgREST query builder can't express. */
const hasArchetype = (node: RuleNode): boolean => {
  if (node.kind === 'cond') return node.condition.kind === 'archetype';
  return node.children.some(hasArchetype);
};

export const filterNeuronCardIds = query(ruleNodeSchema, async (tree): Promise<{ ids: number[]; truncated: boolean; error?: string }> => {
  if (hasVirtualCat(tree)) {
    return { ids: [], truncated: false, error: 'Virtual filter fields must be resolved client-side' };
  }
  if (hasArchetype(tree)) {
    return { ids: [], truncated: false, error: 'Archetype conditions are not supported by the card filter' };
  }
  const lim = validateRuleLimits(tree);
  if (!lim.ok) {
    return { ids: [], truncated: false, error: lim.message };
  }
  const { locals } = getRequestEvent();
  return queryNeuronCardIdsByRule(locals.supabase, tree);
});
