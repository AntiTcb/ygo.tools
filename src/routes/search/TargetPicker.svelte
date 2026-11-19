<script lang="ts">
  import type { PickedTarget } from '#lib/effect-search/targetEdit.js';
  import { untrack } from 'svelte';
  import CardNameInput from './CardNameInput.svelte';
  import TargetFields from './TargetFields.svelte';

  type Kind = PickedTarget['kind'];

  let {
    label,
    summary,
    value,
    kinds,
    selfLabel = 'itself',
    archetypes = [],
    idPrefix,
    onchange,
  }: {
    label: string;
    /** The slot in words ("a WATER monster", "any card"). */
    summary: string;
    value: PickedTarget;
    kinds: readonly Kind[];
    selfLabel?: string;
    archetypes?: string[];
    idPrefix: string;
    onchange: (next: PickedTarget) => void;
  } = $props();

  const kindLabel = $derived<Record<Kind, string>>({ any: 'any card', self: selfLabel, card: 'a specific card', described: 'cards like…' });

  // 'card' and 'described' can be picked before there is anything to search for (and stay picked when their
  // last condition is removed), so the shown kind is local.
  let kind = $state<Kind>('any');
  let cardName = $state('');
  $effect.pre(() => {
    const v = value;
    untrack(() => {
      if (!(v.kind === 'any' && (kind === 'card' || kind === 'described'))) kind = v.kind;
      cardName = v.kind === 'card' ? v.card : '';
    });
  });

  const pick = (k: Kind) => {
    kind = k;
    if (k === 'any' || k === 'self') onchange({ kind: k });
  };
</script>

<details class="border-surface-500/20 rounded border px-2 py-1" data-testid="search-slot-{idPrefix}">
  <summary class="cursor-pointer text-sm">
    <span class="opacity-70">{label}:</span>
    <span class="font-semibold">{summary}</span>
  </summary>
  <div class="flex flex-col gap-2 py-2">
    <div class="flex flex-wrap gap-1 text-xs" role="radiogroup" aria-label={label}>
      {#each kinds as k (k)}
        <button
          type="button"
          role="radio"
          aria-checked={kind === k}
          class="chip {kind === k ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
          onclick={() => pick(k)}>{kindLabel[k]}</button>
      {/each}
    </div>
    {#if kind === 'card'}
      <form
        class="flex items-center gap-1"
        onsubmit={(e) => {
          e.preventDefault();
          if (cardName.trim()) onchange({ kind: 'card', card: cardName.trim() });
        }}>
        <div class="w-72">
          <CardNameInput id="{idPrefix}-card" whole class="text-sm" ariaLabel="{label}: card name" placeholder="Card name" bind:value={cardName} />
        </div>
        <button class="btn preset-tonal-surface btn-sm" type="submit" disabled={!cardName.trim()}>Set</button>
      </form>
    {:else if kind === 'described'}
      <TargetFields
        value={value.kind === 'described' ? value.target : null}
        {archetypes}
        {idPrefix}
        onchange={(t) => onchange(t ? { kind: 'described', target: t } : { kind: 'any' })} />
    {/if}
  </div>
</details>
