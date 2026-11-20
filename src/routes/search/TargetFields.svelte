<script lang="ts">
  import {
    addValue,
    clearField,
    hasValue,
    OTHER_FIELDS,
    setNum,
    showsMonsterFields,
    showsSpellTrapFields,
    toggleValue,
    type ListField,
  } from '#lib/effect-search/targetEdit.js';
  import { ATTRIBUTE_NAMES, CARD_TYPES, MONSTER_KINDS, RACE_NAMES, SPELL_TRAP_TYPES, type Target } from '#lib/effect-search/tagSchema.js';
  import { describeTarget } from '#lib/effect-search/targetRule.js';
  import NumCmpInput from './NumCmpInput.svelte';

  let {
    value,
    onchange,
    archetypes = [],
    idPrefix,
  }: { value: Target | null; onchange: (next: Target | null) => void; archetypes?: string[]; idPrefix: string } = $props();

  /** "quick_play" → "Quick-Play", "synchro" → "Synchro". */
  const word = (v: string) => (v === 'quick_play' ? 'Quick-Play' : v[0]!.toUpperCase() + v.slice(1).replaceAll('_', ' '));

  let race = $state('');
  let archetype = $state('');

  const other = $derived(OTHER_FIELDS.filter((f) => value?.[f] !== undefined));
</script>

{#snippet chips(field: ListField, values: readonly string[], label: (v: string) => string = word)}
  {#each values as v (v)}
    <button
      type="button"
      class="chip {hasValue(value, field, v) ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
      aria-pressed={hasValue(value, field, v)}
      onclick={() => onchange(toggleValue(value, field, v))}>{label(v)}</button>
  {/each}
{/snippet}

{#snippet selected(field: ListField)}
  {#each (value?.[field] as string[] | undefined) ?? [] as v (v)}
    <button type="button" class="chip preset-filled-primary-500" onclick={() => onchange(toggleValue(value, field, v))}>✕ {v}</button>
  {/each}
{/snippet}

<div class="flex flex-col gap-1.5 text-xs">
  <div class="flex flex-wrap items-baseline gap-1">
    <span class="w-20 shrink-0 opacity-70">Card:</span>
    {@render chips('card_types', CARD_TYPES)}
  </div>
  {#if showsMonsterFields(value)}
    <div class="flex flex-wrap items-baseline gap-1">
      <span class="w-20 shrink-0 opacity-70">Attribute:</span>
      {@render chips('attributes', ATTRIBUTE_NAMES, (v) => v)}
    </div>
    <div class="flex flex-wrap items-baseline gap-1">
      <span class="w-20 shrink-0 opacity-70">Type:</span>
      {@render selected('races')}
      <select
        class="select w-auto py-0 text-xs"
        aria-label="Add a monster Type"
        bind:value={race}
        onchange={() => {
          onchange(addValue(value, 'races', race));
          race = '';
        }}>
        <option value="">add…</option>
        {#each RACE_NAMES.filter((r) => !hasValue(value, 'races', r)) as r (r)}<option value={r}>{r}</option>{/each}
      </select>
    </div>
    <div class="flex flex-wrap items-baseline gap-1">
      <span class="w-20 shrink-0 opacity-70">Monster:</span>
      {@render chips('monster_kinds', MONSTER_KINDS)}
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="w-20 shrink-0 opacity-70">Stats:</span>
      <NumCmpInput label="Level" value={value?.level} onchange={(c) => onchange(setNum(value, 'level', c))} />
      <NumCmpInput label="Rank" value={value?.rank} onchange={(c) => onchange(setNum(value, 'rank', c))} />
      <NumCmpInput label="Link" value={value?.link_rating} onchange={(c) => onchange(setNum(value, 'link_rating', c))} />
      <NumCmpInput label="ATK" value={value?.atk} onchange={(c) => onchange(setNum(value, 'atk', c))} />
      <NumCmpInput label="DEF" value={value?.def} onchange={(c) => onchange(setNum(value, 'def', c))} />
    </div>
  {/if}
  {#if showsSpellTrapFields(value)}
    <div class="flex flex-wrap items-baseline gap-1">
      <span class="w-20 shrink-0 opacity-70">Spell/Trap:</span>
      {@render chips('spell_trap_types', SPELL_TRAP_TYPES)}
    </div>
  {/if}
  <form
    class="flex flex-wrap items-baseline gap-1"
    onsubmit={(e) => {
      e.preventDefault();
      onchange(addValue(value, 'archetypes', archetype));
      archetype = '';
    }}>
    <span class="w-20 shrink-0 opacity-70">Archetype:</span>
    {@render selected('archetypes')}
    <input class="input w-40 py-0 text-xs" list="{idPrefix}-archetypes" aria-label="Add an archetype" placeholder="add…" bind:value={archetype} />
    <button type="submit" class="btn preset-tonal-surface btn-sm py-0 text-xs" disabled={!archetype.trim()}>Add</button>
    {#if archetypes.length}
      <datalist id="{idPrefix}-archetypes">
        {#each archetypes as a (a)}<option value={a}></option>{/each}
      </datalist>
    {/if}
  </form>
  {#if other.length}
    <div class="flex flex-wrap items-baseline gap-1">
      <span class="w-20 shrink-0 opacity-70">Also:</span>
      {#each other as f (f)}
        <button type="button" class="chip preset-tonal-surface" onclick={() => onchange(clearField(value, f))}
          >✕ {describeTarget({ [f]: value?.[f] })}</button>
      {/each}
    </div>
  {/if}
</div>
