<script lang="ts">
  import type { RuleNode } from '$lib/db/cardFilterRule';
  import CardFilterRuleEditor from './CardFilterRuleEditor.svelte';

  type Lookups = {
    monsterTypes: { id: number; name: string | null }[];
    cardFrameTypes: { id: number; name: string }[];
    complexFrameTypes: { id: number; name: string }[];
  };

  type Props = {
    ruleTree: RuleNode;
    lookups: Lookups;
  };

  let { ruleTree = $bindable(), lookups }: Props = $props();

  $inspect(ruleTree);
</script>

<CardFilterRuleEditor bind:node={ruleTree} {lookups} depth={0} />
