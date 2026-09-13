<script lang="ts">
  import { browser } from '$app/environment';
  import MonsterCardPicker from '$components/MonsterCardPicker.svelte';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { buildCardStatLine } from '$lib/db/cardStatDisplay';
  import { findGizmekUkaSummons, findGizmekUkaTargets, isLegalGizmekUkaSummon } from '$lib/db/gizmekuka';
  import { useSearchParams } from 'runed/kit';
  import Seo from 'sk-seo';
  import type { PageProps } from './$types';
  import { gizmekukaSearchParamsSchema } from './gizmekukaSearchParams.schema';

  const PAGE_SIZE = 24;

  let { data }: PageProps = $props();
  const { cards } = $derived(data);

  const params = useSearchParams(gizmekukaSearchParamsSchema, {
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
  const selectedCard = $derived(params.monsterId != null ? (cardById.get(params.monsterId) ?? null) : null);
  const selectedCanBeSummon = $derived(selectedCard != null && isLegalGizmekUkaSummon(selectedCard));

  $effect(() => {
    if (!browser || cards.length === 0) return;
    const monsterId = params.monsterId;
    if (monsterId == null) return;
    if (!cardById.get(monsterId)) {
      params.monsterId = null;
    }
  });

  const setMonsterId = (next: number | null) => {
    if (next === params.monsterId) return;
    params.update({
      monsterId: next,
      resultNameFilter: '',
      summonPage: 1,
      targetPage: 1,
    });
  };

  const setResultNameFilter = (next: string) => {
    params.update({
      resultNameFilter: next,
      summonPage: 1,
      targetPage: 1,
    });
  };

  const filterByName = <T extends { name: string }>(list: T[]) => {
    const q = params.resultNameFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((card) => card.name.toLowerCase().includes(q));
  };

  const summons = $derived.by(() => {
    if (!selectedCard) return [];
    return findGizmekUkaSummons(selectedCard, cards).sort((a, b) => a.name.localeCompare(b.name));
  });

  const targets = $derived.by(() => {
    if (!selectedCard) return [];
    return findGizmekUkaTargets(selectedCard, cards).sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredSummons = $derived(filterByName(summons));
  const filteredTargets = $derived(filterByName(targets));

  const summonTotalPages = $derived(Math.max(1, Math.ceil(filteredSummons.length / PAGE_SIZE)));
  const targetTotalPages = $derived(Math.max(1, Math.ceil(filteredTargets.length / PAGE_SIZE)));
  const safeSummonPage = $derived(Math.min(params.summonPage, summonTotalPages));
  const safeTargetPage = $derived(Math.min(params.targetPage, targetTotalPages));
  const visibleSummons = $derived(filteredSummons.slice((safeSummonPage - 1) * PAGE_SIZE, safeSummonPage * PAGE_SIZE));
  const visibleTargets = $derived(filteredTargets.slice((safeTargetPage - 1) * PAGE_SIZE, safeTargetPage * PAGE_SIZE));
  const filterActive = $derived(params.resultNameFilter.trim().length > 0);

  $effect(() => {
    if (!browser) return;
    if (params.summonPage > summonTotalPages) params.summonPage = summonTotalPages;
    if (params.targetPage > targetTotalPages) params.targetPage = targetTotalPages;
  });
</script>

<Seo
  title="Gizmek Uka Helper"
  description="Find Gizmek Uka summons whose ATK equals their own DEF and share an Attribute, or the reverse — legal Attribute-matching targets."
  keywords="yugioh, ygo, gizmek uka, attribute, atk, def, Yu-Gi-Oh!"
  author="AntiTcb" />

<div class="card mx-auto my-2 w-full max-w-3xl p-3 sm:p-4">
  <h1 class="h3 mb-2">Gizmek Uka Helper</h1>
  <p class="mb-4 text-sm opacity-80">
    Pick any non-Token monster — the one your opponent controls, or a Main Deck monster whose ATK equals its own DEF that you want to Special Summon.
    Summons are legal if the selected card is the opponent's monster. Targets appear when the selected card itself can be summoned: same Attribute, from
    hand or Deck, ATK equal to its own DEF.
  </p>

  <MonsterCardPicker
    label="Monster"
    testIdPrefix="gizmekuka-monster"
    candidates={cards}
    bind:selectedId={() => params.monsterId, (v) => setMonsterId(v)}
    placeholder="Search a monster…"
    hint="Any non-Token monster, including Extra Deck. Use it as the opponent's monster or as the ATK=DEF monster you want to summon." />
</div>

{#if selectedCard}
  <div class="flex flex-col gap-2 px-1">
    <label class="label flex max-w-md flex-col gap-1">
      <span class="label-text text-xs font-medium">Filter results by name</span>
      <input
        class="input w-full text-sm"
        type="text"
        data-testid="gizmekuka-result-filter"
        placeholder="Search results…"
        autocomplete="off"
        value={params.resultNameFilter}
        oninput={(e) => setResultNameFilter(e.currentTarget.value)} />
    </label>
  </div>

  <section class="mt-4" data-testid="gizmekuka-summons">
    <h2 class="h4 px-1">Summons</h2>
    <p class="mb-2 px-1 text-sm opacity-70">Main Deck monsters whose ATK equals their own DEF and share this Attribute.</p>
    <p class="px-1 text-sm" data-testid="gizmekuka-summons-count">
      {filteredSummons.length} summons{#if filterActive && filteredSummons.length < summons.length}<span class="opacity-60">{` (of ${summons.length})`}</span>{/if}
    </p>

    {@render listPaginator('summon', safeSummonPage, summonTotalPages)}

    <div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
      {#each visibleSummons as card (card.id)}
        {@render resultCard(card, 'gizmekuka-summon-card', ['Attribute', 'ATK = DEF'])}
      {/each}
    </div>

    {@render listPaginator('summon', safeSummonPage, summonTotalPages)}
  </section>

  <section class="mt-6" data-testid="gizmekuka-targets">
    <h2 class="h4 px-1">Targets</h2>
    {#if selectedCanBeSummon}
      <p class="mb-2 px-1 text-sm opacity-70">Face-up monsters that share this Attribute — legal if the selected card is the summon.</p>
      <p class="px-1 text-sm" data-testid="gizmekuka-targets-count">
        {filteredTargets.length} targets{#if filterActive && filteredTargets.length < targets.length}<span class="opacity-60">{` (of ${targets.length})`}</span>{/if}
      </p>

      {@render listPaginator('target', safeTargetPage, targetTotalPages)}

      <div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
        {#each visibleTargets as card (card.id)}
          {@render resultCard(card, 'gizmekuka-target-card', ['Attribute'])}
        {/each}
      </div>

      {@render listPaginator('target', safeTargetPage, targetTotalPages)}
    {:else}
      <p class="px-1 text-sm opacity-70" data-testid="gizmekuka-targets-unavailable">
        This monster cannot be Special Summoned by Gizmek Uka — summons must come from the hand or Deck and have ATK equal to their own DEF.
      </p>
    {/if}
  </section>
{/if}

{#snippet listPaginator(kind: 'summon' | 'target', safePage: number, totalPages: number)}
  {@const pageKey = kind === 'summon' ? 'summonPage' : 'targetPage'}
  <div class="flex flex-wrap items-center justify-center gap-3 px-1 py-2">
    <button
      type="button"
      class="btn preset-tonal-surface btn-sm"
      data-testid="gizmekuka-{kind}-page-prev"
      disabled={safePage <= 1}
      onclick={() => (params[pageKey] = Math.max(1, safePage - 1))}>
      Prev
    </button>
    <span class="text-sm tabular-nums" data-testid="gizmekuka-{kind}-page-label">Page {safePage} of {totalPages}</span>
    <button
      type="button"
      class="btn preset-tonal-surface btn-sm"
      data-testid="gizmekuka-{kind}-page-next"
      disabled={safePage >= totalPages}
      onclick={() => (params[pageKey] = Math.min(totalPages, safePage + 1))}>
      Next
    </button>
  </div>
{/snippet}

{#snippet resultCard(card: (typeof cards)[number], testId: string, chips: string[])}
  {@const stats = buildCardStatLine(card, lookupMaps)}
  <div class="card flex grow-0 flex-col items-center gap-2 space-y-0! p-3" data-testid={testId} data-card-id={card.id}>
    <img class="aspect-6/8.5 max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
    <article class="flex w-full grow flex-col gap-1">
      <p class="text-center text-sm font-bold" data-testid="{testId}-name">{card.name}</p>
      <p class="flex flex-wrap justify-center gap-1">
        {#each chips as chip (chip)}
          <span class="chip preset-tonal-surface text-xs" data-testid="{testId}-chip">{chip}</span>
        {/each}
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
{/snippet}
