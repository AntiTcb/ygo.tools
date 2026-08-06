<script lang="ts">
  import { ATTRIBUTES, CARD_TYPES, SPELLTRAP_SUBTYPES } from '$lib/db/cardEnums';
  import type { Condition, RuleNode } from '$lib/db/cardFilterRule';
  import LinkArrowMaskPicker from './LinkArrowMaskPicker.svelte';
  import Self from './CardFilterRuleEditor.svelte';

  type Lookups = {
    monsterTypes: { id: number; name: string | null }[];
    cardFrameTypes: { id: number; name: string }[];
    complexFrameTypes: { id: number; name: string }[];
  };

  type Props = {
    node: RuleNode;
    lookups: Lookups;
    depth?: number;
    onRemove?: (() => void) | undefined;
  };

  let { node = $bindable(), lookups, depth = 0, onRemove }: Props = $props();

  const attributeEntries = () =>
    (Object.entries(ATTRIBUTES) as [string, string][]).map(([id, name]) => ({
      id: Number(id),
      name,
    }));

  const cardTypeEntries = () =>
    (Object.entries(CARD_TYPES) as [string, string][]).map(([id, name]) => ({
      id: Number(id),
      name,
    }));

  const spelltrapEntries = () =>
    (Object.entries(SPELLTRAP_SUBTYPES) as [string, string][]).map(([id, name]) => ({
      id: Number(id),
      name,
    }));

  const defaultCondition = (): Condition => ({ kind: 'num', field: 'atk', op: 'gte', value: 0 });

  const addCondition = () => {
    if (node.kind !== 'group') return;
    node.children = [...node.children, { kind: 'cond', condition: defaultCondition() }];
  };

  const addGroup = () => {
    if (node.kind !== 'group') return;
    node.children = [...node.children, { kind: 'group', logic: 'and', children: [{ kind: 'cond', condition: defaultCondition() }] }];
  };

  const removeChild = (index: number) => {
    if (node.kind !== 'group') return;
    node.children = node.children.filter((_, i) => i !== index);
  };

  const onFieldKindChange = (raw: string) => {
    if (node.kind !== 'cond') return;
    if (raw.startsWith('num:')) {
      const field = raw.slice(4) as Extract<Condition, { kind: 'num' }>['field'];
      node.condition = { kind: 'num', field, op: 'gte', value: 0 };
      return;
    }
    if (raw.startsWith('cat:')) {
      const field = raw.slice(4) as Extract<Condition, { kind: 'cat' }>['field'];
      node.condition = { kind: 'cat', field, op: 'in', values: [] };
      return;
    }
    if (raw === 'bits:link_arrows') {
      node.condition = { kind: 'bits', field: 'link_arrows', op: 'eq', values: [] };
      return;
    }
    if (raw === 'text:pendulum_text') {
      node.condition = { kind: 'text', field: 'pendulum_text', op: 'contains', value: '' };
    }
  };

  const fieldKindValue = $derived.by((): string => {
    if (node.kind !== 'cond') return 'num:atk';
    const c = node.condition;
    if (c.kind === 'num') return `num:${c.field}`;
    if (c.kind === 'cat') return `cat:${c.field}`;
    if (c.kind === 'bits') return 'bits:link_arrows';
    return 'text:pendulum_text';
  });

  const toggleCatValue = (field: Extract<Condition, { kind: 'cat' }>, id: number) => {
    const cur = new Set(field.values ?? []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    field.values = [...cur].sort((a, b) => a - b);
  };

  const catOptions = $derived.by((): { id: number; name: string }[] => {
    if (node.kind !== 'cond' || node.condition.kind !== 'cat') return [];
    const field = node.condition.field;
    if (field === 'attribute_id') return attributeEntries();
    if (field === 'species_id') return lookups.monsterTypes.map((o) => ({ id: o.id, name: o.name ?? String(o.id) }));
    if (field === 'frame_type_id') return lookups.complexFrameTypes.map((o) => ({ id: o.id, name: o.name }));
    if (field === 'effect_id') return spelltrapEntries();
    if (field === 'card_type') return cardTypeEntries();
    if (field === 'frame_subtype') return lookups.cardFrameTypes.map((o) => ({ id: o.id, name: o.name }));
    return [];
  });
</script>

{#if node.kind === 'group'}
  <div class={['space-y-2', depth > 0 && 'border-surface-500/25 ml-0.5 border-l-2 pl-2.5']}>
    <div class="flex flex-wrap items-center gap-2">
      <div class="bg-surface-500/10 inline-flex rounded p-0.5 text-xs" role="group" aria-label="Group logic">
        <button
          type="button"
          class="rounded px-2.5 py-1 transition-colors"
          class:bg-surface-500={node.logic === 'and'}
          class:text-surface-50={node.logic === 'and'}
          class:opacity-70={node.logic !== 'and'}
          onclick={() => (node.logic = 'and')}>
          Match all
        </button>
        <button
          type="button"
          class="rounded px-2.5 py-1 transition-colors"
          class:bg-surface-500={node.logic === 'or'}
          class:text-surface-50={node.logic === 'or'}
          class:opacity-70={node.logic !== 'or'}
          onclick={() => (node.logic = 'or')}>
          Match any
        </button>
      </div>
      {#if depth > 0}
        <button type="button" class="btn btn-sm preset-ghost-surface" onclick={() => onRemove?.()}>Remove group</button>
      {/if}
    </div>

    {#if node.children.length === 0}
      <div class="border-surface-500/25 rounded border border-dashed px-3 py-4 text-center text-sm opacity-70">
        No conditions yet. Add a condition to filter by ATK, type, attribute, and more.
      </div>
    {:else}
      <ul class="space-y-2">
        {#each node.children as child, i (child)}
          <li>
            {#if i > 0}
              <p class="pb-1 text-[0.65rem] font-semibold tracking-wide uppercase opacity-50">
                {node.logic === 'and' ? 'and' : 'or'}
              </p>
            {/if}
            <Self bind:node={node.children[i]} {lookups} depth={depth + 1} onRemove={() => removeChild(i)} />
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="btn btn-sm preset-filled-surface-500"
        data-testid={depth === 0 ? 'filter-add-condition' : 'filter-add-condition-nested'}
        onclick={() => addCondition()}>+ Condition</button>
      <button
        type="button"
        class="btn btn-sm preset-tonal-surface"
        data-testid={depth === 0 ? 'filter-add-group' : 'filter-add-group-nested'}
        onclick={() => addGroup()}>+ Nested group</button>
    </div>
  </div>
{:else}
  {@const c = node.condition}
  <div class="border-surface-500/30 bg-surface-500/5 flex flex-col gap-2 rounded-md border p-2">
    <div class="flex flex-wrap items-end gap-2">
      <label class="label min-w-40 grow basis-40">
        <span class="label-text text-xs">Field</span>
        <select
          class="select text-sm"
          data-testid="filter-condition-field"
          value={fieldKindValue}
          onchange={(e) => onFieldKindChange((e.currentTarget as HTMLSelectElement).value)}>
          <optgroup label="Stats">
            <option value="num:atk">ATK</option>
            <option value="num:def">DEF</option>
            <option value="num:level">Level / Rank</option>
            <option value="num:link_rating">Link Rating</option>
            <option value="num:pend_scale_l">Pendulum Scale L</option>
            <option value="num:pend_scale_r">Pendulum Scale R</option>
          </optgroup>
          <optgroup label="Identity">
            <option value="cat:attribute_id">Attribute</option>
            <option value="cat:species_id">Monster Type</option>
            <option value="cat:card_type">Card type</option>
            <option value="cat:frame_subtype">Frame subtype</option>
            <option value="cat:frame_type_id">Complex frame</option>
            <option value="cat:effect_id">Spell/Trap subtype</option>
          </optgroup>
          <optgroup label="Other">
            <option value="bits:link_arrows">Link arrows</option>
            <option value="text:pendulum_text">Pendulum text (contains)</option>
          </optgroup>
        </select>
      </label>

      {#if c.kind === 'num'}
        <label class="label min-w-36 grow basis-36">
          <span class="label-text text-xs">Comparison</span>
          <select class="select text-sm" bind:value={c.op}>
            <option value="eq">equals</option>
            <option value="neq">not equal</option>
            <option value="gt">greater than</option>
            <option value="gte">at least</option>
            <option value="lt">less than</option>
            <option value="lte">at most</option>
            <option value="isNull">is empty</option>
            <option value="notNull">is set</option>
            {#if c.field === 'atk' || c.field === 'def'}
              <option value="isQuestion">is ?</option>
              <option value="notQuestion">is numeric (not ?)</option>
            {/if}
          </select>
        </label>
        {#if c.op !== 'isNull' && c.op !== 'notNull' && c.op !== 'isQuestion' && c.op !== 'notQuestion'}
          <label class="label w-28">
            <span class="label-text text-xs">Value</span>
            <input class="input text-sm" type="number" bind:value={c.value} />
          </label>
        {/if}
      {:else if c.kind === 'cat'}
        <label class="label min-w-36 grow basis-36">
          <span class="label-text text-xs">Match</span>
          <select class="select text-sm" bind:value={c.op}>
            <option value="in">is any of…</option>
            <option value="notIn">is none of…</option>
            <option value="isNull">is empty</option>
            <option value="notNull">is set</option>
          </select>
        </label>
      {:else if c.kind === 'text'}
        <label class="label min-w-36 grow basis-36">
          <span class="label-text text-xs">Match</span>
          <select class="select text-sm" bind:value={c.op}>
            <option value="contains">contains</option>
            <option value="eq">equals</option>
            <option value="isNull">is empty</option>
            <option value="notNull">is set</option>
          </select>
        </label>
        {#if c.op === 'contains' || c.op === 'eq'}
          <label class="label min-w-40 grow">
            <span class="label-text text-xs">Text</span>
            <input class="input text-sm" type="text" bind:value={c.value} />
          </label>
        {/if}
      {/if}

      {#if depth > 0}
        <button type="button" class="btn btn-sm preset-ghost-error self-end" onclick={() => onRemove?.()}>Remove</button>
      {/if}
    </div>

    {#if c.kind === 'cat' && (c.op === 'in' || c.op === 'notIn')}
      <div class="flex max-h-48 flex-wrap content-start gap-1.5 overflow-y-auto" role="group" aria-label="Values">
        {#each catOptions as o (o.id)}
          {@const on = (c.values ?? []).includes(o.id)}
          <button
            type="button"
            class="btn btn-sm"
            class:preset-filled-primary-500={on}
            class:preset-tonal-surface={!on}
            data-testid={c.field === 'attribute_id' && o.id === 2 ? 'filter-attribute-dark' : undefined}
            aria-pressed={on}
            onclick={() => toggleCatValue(c, o.id)}>
            {o.name}
          </button>
        {/each}
      </div>
      {#if !c.values?.length}
        <p class="text-xs opacity-60">Select one or more values.</p>
      {/if}
    {:else if c.kind === 'bits'}
      <div class="flex flex-col gap-1">
        <span class="label-text text-xs">Exact arrow set</span>
        <LinkArrowMaskPicker bind:values={c.values} />
      </div>
    {/if}
  </div>
{/if}
