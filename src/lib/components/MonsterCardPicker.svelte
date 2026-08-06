<script lang="ts" generics="T extends { id: number; name: string }">
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';

  type Props = {
    candidates: T[];
    label: string;
    testIdPrefix: string;
    selectedId: number | null;
    disabled?: boolean;
    placeholder?: string;
    hint?: string;
  };

  let { candidates, label, testIdPrefix, selectedId = $bindable(null), disabled = false, placeholder = 'Search by name…', hint }: Props = $props();

  const artworks = getArtworksState();
  const MAX_SUGGESTIONS = 12;

  let query = $state('');

  const candidateById = $derived(new Map(candidates.map((c) => [c.id, c] as const)));
  const selectedCard = $derived(selectedId != null ? (candidateById.get(selectedId) ?? null) : null);

  const suggestions = $derived.by(() => {
    const q = query.trim();
    if (!q || disabled) return [] as T[];

    const lower = q.toLowerCase();
    const startsWith: T[] = [];
    const includes: T[] = [];

    for (const card of candidates) {
      const nameLower = card.name.toLowerCase();
      if (nameLower.startsWith(lower)) {
        startsWith.push(card);
      } else if (nameLower.includes(lower)) {
        includes.push(card);
      }
    }

    const byName = (a: T, b: T) => a.name.localeCompare(b.name);
    startsWith.sort(byName);
    includes.sort(byName);

    return [...startsWith, ...includes].slice(0, MAX_SUGGESTIONS);
  });

  const selectCard = (id: number) => {
    selectedId = id;
    query = '';
  };

  const clearSelection = () => {
    selectedId = null;
    query = '';
  };
</script>

<div class="flex flex-col gap-1.5">
  <label class="label flex flex-col gap-1">
    <span class="label-text text-xs font-medium">{label}</span>
    <input
      class="input w-full text-sm"
      type="text"
      data-testid="{testIdPrefix}-input"
      bind:value={query}
      {placeholder}
      {disabled}
      autocomplete="off"
      role="combobox"
      aria-expanded={suggestions.length > 0}
      aria-controls="{testIdPrefix}-suggestions"
      aria-autocomplete="list" />
  </label>

  {#if hint}
    <p class="text-xs opacity-60">{hint}</p>
  {/if}

  {#if selectedCard}
    {@const selectedArt = artworks.getArtwork(selectedCard.id)?.bestArt}
    <div class="flex flex-wrap items-center gap-2 text-sm" data-testid="{testIdPrefix}-selected">
      <span class="flex items-center gap-2">
        {#if selectedArt}
          <img class="aspect-6/8.5 h-8 shrink-0 rounded object-cover" src={selectedArt} alt="" />
        {:else}
          <span class="bg-surface-500/20 aspect-6/8.5 h-8 shrink-0 rounded" aria-hidden="true"></span>
        {/if}
        <span class="font-medium">{selectedCard.name}</span>
      </span>
      <button type="button" class="btn btn-sm preset-tonal-surface" data-testid="{testIdPrefix}-clear" onclick={clearSelection} {disabled}>
        Clear
      </button>
    </div>
  {/if}

  {#if !disabled && query.trim() && suggestions.length > 0}
    <ul
      id="{testIdPrefix}-suggestions"
      class="border-surface-500/40 bg-surface-50-950 max-h-60 overflow-y-auto rounded border text-sm"
      role="listbox">
      {#each suggestions as card (card.id)}
        {@const art = artworks.getArtwork(card.id)?.bestArt}
        <li role="option" aria-selected={selectedId === card.id}>
          <button
            type="button"
            class="hover:bg-surface-500/15 flex w-full items-center gap-2 px-3 py-2 text-left"
            data-testid="{testIdPrefix}-suggestion"
            data-card-id={card.id}
            onclick={() => selectCard(card.id)}>
            {#if art}
              <img class="aspect-6/8.5 h-8 shrink-0 rounded object-cover" src={art} alt="" />
            {:else}
              <span class="bg-surface-500/20 aspect-6/8.5 h-8 shrink-0 rounded" aria-hidden="true"></span>
            {/if}
            <span>{card.name}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
