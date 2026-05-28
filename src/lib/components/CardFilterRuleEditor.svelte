<script lang="ts">
  import { ATTRIBUTES, CARD_TYPES, SPELLTRAP_SUBTYPES } from '$lib/db/cardEnums';
  import type { Condition, RuleNode } from '$lib/db/cardFilterRule';
  import LinkArrowMaskPicker from './LinkArrowMaskPicker.svelte';

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
      node.condition = { kind: 'bits', field: 'link_arrows', op: 'isNull' };
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
</script>

{#if node.kind === 'group'}
  <div class="border-surface-500/30 space-y-1.5 rounded border p-1.5" class:ml-2={depth > 0}>
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="text-sm font-semibold">{depth === 0 ? 'Stat filters' : 'Group'}</span>
      <select class="select text-sm" bind:value={node.logic}>
        <option value="and">All (AND)</option>
        <option value="or">Any (OR)</option>
      </select>
      {#if depth > 0}
        <button type="button" class="btn btn-sm preset-ghost-surface" onclick={() => onRemove?.()}>Remove group</button>
      {/if}
    </div>

    {#each node.children as _, i (i)}
      <svelte:self bind:node={node.children[i]} {lookups} depth={depth + 1} onRemove={() => removeChild(i)} />
    {/each}

    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="btn btn-sm preset-filled-surface-500"
        data-testid={depth === 0 ? 'filter-add-condition' : undefined}
        onclick={addCondition}>+ Condition</button>
      <button type="button" class="btn btn-sm preset-tonal-surface" onclick={addGroup}>+ Group</button>
    </div>
  </div>
{:else}
  {@const c = node.condition}
  <div class="border-surface-500/30 flex flex-col gap-1.5 rounded border p-1.5 md:flex-row md:items-end">
    <label class="label grow">
      <span class="label-text">Field</span>
      <select
        class="select text-sm"
        data-testid="filter-condition-field"
        value={fieldKindValue}
        onchange={(e) => onFieldKindChange((e.currentTarget as HTMLSelectElement).value)}>
        <optgroup label="Numeric">
          <option value="num:atk">ATK</option>
          <option value="num:def">DEF</option>
          <option value="num:level">Level / Rank</option>
          <option value="num:link_rating">Link Rating</option>
          <option value="num:pend_scale_l">Pendulum Scale L</option>
          <option value="num:pend_scale_r">Pendulum Scale R</option>
        </optgroup>
        <optgroup label="Categories">
          <option value="cat:attribute_id">Attribute</option>
          <option value="cat:species_id">Monster Type (species)</option>
          <option value="cat:frame_type_id">Complex frame type</option>
          <option value="cat:effect_id">Spell/Trap subtype</option>
          <option value="cat:card_type">Card type (Monster/Spell/Trap)</option>
          <option value="cat:frame_subtype">Frame subtype (tuner, fusion, …)</option>
        </optgroup>
        <optgroup label="Other">
          <option value="bits:link_arrows">Link arrows</option>
          <option value="text:pendulum_text">Pendulum text</option>
        </optgroup>
      </select>
    </label>

    {#if c.kind === 'num'}
      <label class="label">
        <span class="label-text">Op</span>
        <select class="select text-sm" bind:value={c.op}>
          <option value="eq">=</option>
          <option value="neq">≠</option>
          <option value="gt">&gt;</option>
          <option value="gte">≥</option>
          <option value="lt">&lt;</option>
          <option value="lte">≤</option>
          <option value="isNull">is null</option>
          <option value="notNull">not null</option>
          {#if c.field === 'atk' || c.field === 'def'}
            <option value="isQuestion">is ? (stored as -1)</option>
            <option value="notQuestion">has numeric ATK/DEF (not ?)</option>
          {/if}
        </select>
      </label>
      {#if c.op !== 'isNull' && c.op !== 'notNull' && c.op !== 'isQuestion' && c.op !== 'notQuestion'}
        <label class="label">
          <span class="label-text">Value</span>
          <input class="input text-sm" type="number" bind:value={c.value} />
        </label>
      {/if}
    {:else if c.kind === 'cat'}
      <label class="label">
        <span class="label-text">Op</span>
        <select class="select text-sm" bind:value={c.op}>
          <option value="in">is any of…</option>
          <option value="notIn">is none of…</option>
          <option value="isNull">is null</option>
          <option value="notNull">not null</option>
        </select>
      </label>
      {#if c.op === 'in' || c.op === 'notIn'}
        <fieldset class="fieldset max-h-40 grow overflow-y-auto rounded border p-2 text-sm">
          <legend class="text-xs font-semibold">Values (toggle)</legend>
          {#if c.field === 'attribute_id'}
            {#each attributeEntries() as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  data-testid={o.id === 2 ? 'filter-attribute-dark' : undefined}
                  checked={(c.values ?? []).includes(o.id)}
                  onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name}</span>
              </label>
            {/each}
          {:else if c.field === 'species_id'}
            {#each lookups.monsterTypes as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={(c.values ?? []).includes(o.id)} onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name ?? o.id}</span>
              </label>
            {/each}
          {:else if c.field === 'frame_type_id'}
            {#each lookups.complexFrameTypes as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={(c.values ?? []).includes(o.id)} onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name} (#{o.id})</span>
              </label>
            {/each}
          {:else if c.field === 'effect_id'}
            {#each spelltrapEntries() as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={(c.values ?? []).includes(o.id)} onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name}</span>
              </label>
            {/each}
          {:else if c.field === 'card_type'}
            {#each cardTypeEntries() as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={(c.values ?? []).includes(o.id)} onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name}</span>
              </label>
            {/each}
          {:else if c.field === 'frame_subtype'}
            {#each lookups.cardFrameTypes as o (o.id)}
              <label class="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" checked={(c.values ?? []).includes(o.id)} onchange={() => toggleCatValue(c, o.id)} />
                <span>{o.name}</span>
              </label>
            {/each}
          {/if}
        </fieldset>
      {/if}
    {:else if c.kind === 'bits'}
      <div class="flex flex-col gap-1">
        <LinkArrowMaskPicker bind:values={c.values} />
      </div>
    {:else if c.kind === 'text'}
      <label class="label">
        <span class="label-text">Op</span>
        <select class="select text-sm" bind:value={c.op}>
          <option value="contains">contains</option>
          <option value="eq">equals</option>
          <option value="isNull">is null</option>
          <option value="notNull">not null</option>
        </select>
      </label>
      {#if c.op === 'contains' || c.op === 'eq'}
        <label class="label grow">
          <span class="label-text">Text</span>
          <input class="input text-sm" type="text" bind:value={c.value} />
        </label>
      {/if}
    {/if}

    {#if depth > 0}
      <button type="button" class="btn btn-sm preset-ghost-error self-end" onclick={() => onRemove?.()}>Remove</button>
    {/if}
  </div>
{/if}
