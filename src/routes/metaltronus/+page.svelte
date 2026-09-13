<script lang="ts">
  import { browser } from '$app/environment';
  import MonsterCardPicker from '$components/MonsterCardPicker.svelte';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { buildCardStatLine } from '$lib/db/cardStatDisplay';
  import { findMetaltronusMatches, METALTRONUS_PROPERTY_LABELS } from '$lib/db/metaltronus';
  import { useSearchParams } from 'runed/kit';
  import Seo from 'sk-seo';
  import type { PageProps } from './$types';
  import { metaltronusSearchParamsSchema } from './metaltronusSearchParams.schema';

  const PAGE_SIZE = 24;

  let { data }: PageProps = $props();
  const { cards } = $derived(data);

  const params = useSearchParams(metaltronusSearchParamsSchema, {
    pushHistory: false,
    debounce: 300,
    noScroll: true,
    compress: true,
  });

  const artworks = getArtworksState();

  const lookupMaps = $derived.by(() => {
    const speciesById = new Map(data.lookups.monsterTypes.filter((row) => row.name).map((row) => [row.id, row.name as string] as const));
    const frameById = new Map(data.lookups.cardFrameTypes.map((row) => [row.id, row.name] as const));
    return { speciesById, frameById };
  });

  const cardById = $derived(new Map(cards.map((c) => [c.id, c] as const)));
  const targetCard = $derived(params.targetId != null ? (cardById.get(params.targetId) ?? null) : null);

  /** Drop stale/invalid ids from shared URLs once card data is available. */
  $effect(() => {
    if (!browser || cards.length === 0) return;
    const targetId = params.targetId;
    if (targetId == null) return;
    if (!cardById.get(targetId)) {
      params.targetId = null;
    }
  });

  const setTargetId = (next: number | null) => {
    if (next === params.targetId) return;
    params.update({
      targetId: next,
      resultNameFilter: '',
      page: 1,
    });
  };

  const setResultNameFilter = (next: string) => {
    params.update({
      resultNameFilter: next,
      page: 1,
    });
  };

  const matches = $derived.by(() => {
    if (!targetCard) return [];
    return findMetaltronusMatches(targetCard, cards).sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredMatches = $derived.by(() => {
    const q = params.resultNameFilter.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter((card) => card.name.toLowerCase().includes(q));
  });

  const filteredCount = $derived(filteredMatches.length);
  const totalPages = $derived(Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)));
  const safePage = $derived(Math.min(params.page, totalPages));
  const visibleMatches = $derived(filteredMatches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE));
  const filterActive = $derived(params.resultNameFilter.trim().length > 0 && filteredCount < matches.length);

  $effect(() => {
    if (!browser) return;
    if (params.page > totalPages) params.page = totalPages;
  });
</script>

<Seo
  title="Metaltronus Helper"
  description="Find legal Metaltronus partners: monsters that share two or more of Type, Attribute, and ATK — as summons or as targets."
  keywords="yugioh, ygo, metaltronus, type, attribute, atk, Yu-Gi-Oh!"
  author="AntiTcb" />

<div class="card mx-auto my-2 w-full max-w-3xl p-3 sm:p-4">
  <h1 class="h3 mb-2">Metaltronus Helper</h1>
  <p class="mb-4 text-sm opacity-80">
    Pick any non-Token monster — the one your opponent controls, or the one you want to Special Summon. The list shows every monster that shares two or
    more of Type, Attribute, and/or ATK. Those are legal summons if the selected card is the target, or legal targets if it is the summon.
  </p>

  <MonsterCardPicker
    label="Monster"
    testIdPrefix="metaltronus-target"
    candidates={cards}
    bind:selectedId={() => params.targetId, (v) => setTargetId(v)}
    placeholder="Search a monster…"
    hint="Any non-Token monster, including Extra Deck. Use it as the opponent's target or as the monster you want to summon." />
</div>

{#if targetCard}
  <div class="flex flex-col gap-2 px-1">
    <label class="label flex max-w-md flex-col gap-1">
      <span class="label-text text-xs font-medium">Filter partners by name</span>
      <input
        class="input w-full text-sm"
        type="text"
        data-testid="metaltronus-result-filter"
        placeholder="Search partners…"
        autocomplete="off"
        value={params.resultNameFilter}
        oninput={(e) => setResultNameFilter(e.currentTarget.value)} />
    </label>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm" data-testid="metaltronus-results-count">
        {filteredCount} partners{#if filterActive}<span class="opacity-60">{` (of ${matches.length})`}</span>{/if}
      </p>
    </div>
  </div>

  {@render resultsPaginator()}

  <div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
    {#each visibleMatches as card (card.id)}
      {@const stats = buildCardStatLine(card, lookupMaps)}
      <div class="card flex grow-0 flex-col items-center gap-2 space-y-0! p-3" data-testid="metaltronus-card" data-card-id={card.id}>
        <img class="aspect-6/8.5 max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
        <article class="flex w-full grow flex-col gap-1">
          <p class="text-center text-sm font-bold" data-testid="metaltronus-card-name">{card.name}</p>

          <p class="flex flex-wrap justify-center gap-1">
            {#each card.shared as prop (prop)}
              <span class="chip preset-tonal-surface text-xs" data-testid="metaltronus-card-shared-prop">
                {METALTRONUS_PROPERTY_LABELS[prop]}
              </span>
            {/each}
            {#if card.sameName}
              <span class="chip preset-filled-primary-500 text-xs" data-testid="metaltronus-card-same-name">Same name</span>
            {/if}
          </p>

          <div class="text-center text-xs leading-snug opacity-85">
            {#if stats.attribute || stats.typeLine}
              <p>
                {#if stats.attribute}<span class="font-medium">{stats.attribute}</span>{/if}
                {#if stats.attribute && stats.typeLine}<span class="opacity-50"> · </span>{/if}
                {#if stats.typeLine}{stats.typeLine}{/if}
              </p>
            {/if}
            <p class="font-mono tabular-nums">
              {#if stats.levelLine}{stats.levelLine}{/if}
              {#if stats.levelLine && stats.scaleLine}<span class="opacity-50"> · </span>{/if}
              {#if stats.scaleLine}{stats.scaleLine}{/if}
              {#if stats.levelLine || stats.scaleLine}<span class="opacity-50"> · </span>{/if}
              <span title="ATK / DEF">{stats.atkDef}</span>
            </p>
          </div>
        </article>
      </div>
    {/each}
  </div>

  {@render resultsPaginator()}
{/if}

{#snippet resultsPaginator()}
  <div class="flex flex-wrap items-center justify-center gap-3 px-1 py-2">
    <button
      type="button"
      class="btn preset-tonal-surface btn-sm"
      data-testid="metaltronus-page-prev"
      disabled={safePage <= 1}
      onclick={() => (params.page = Math.max(1, safePage - 1))}>
      Prev
    </button>
    <span class="text-sm tabular-nums" data-testid="metaltronus-page-label">Page {safePage} of {totalPages}</span>
    <button
      type="button"
      class="btn preset-tonal-surface btn-sm"
      data-testid="metaltronus-page-next"
      disabled={safePage >= totalPages}
      onclick={() => (params.page = Math.min(totalPages, safePage + 1))}>
      Next
    </button>
  </div>
{/snippet}
