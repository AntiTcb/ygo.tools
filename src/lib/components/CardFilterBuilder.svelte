<script lang="ts">
  import { countRuleLeaves, type RuleNode } from '$lib/db/cardFilterRule';
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

  const leafCount = $derived(countRuleLeaves(ruleTree));
</script>

<div class="flex min-h-0 flex-col gap-2">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-xs opacity-70">
      Combine conditions with Match all / Match any. Nest groups for (A and B) or C style queries.
    </p>
    {#if leafCount > 0}
      <span class="text-xs tabular-nums opacity-60">{leafCount} condition{leafCount === 1 ? '' : 's'}</span>
    {/if}
  </div>
  <CardFilterRuleEditor bind:node={ruleTree} {lookups} depth={0} />
</div>
