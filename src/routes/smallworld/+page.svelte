<script lang="ts">
  import MonsterCardPicker from '$components/MonsterCardPicker.svelte';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { buildCardStatLine } from '$lib/db/cardStatDisplay';
  import {
    findExactBridges,
    findExactTargets,
    getSharedProperties,
    isExactOneBridge,
    SMALL_WORLD_PROPERTY_LABELS,
    type SmallWorldProperty,
  } from '$lib/db/smallWorld';
  import Seo from 'sk-seo';
  import type { PageProps } from './$types';

  const PAGE_SIZE = 24;

  let { data }: PageProps = $props();
  const { cards } = $derived(data);

  let revealId = $state<number | null>(null);
  let bridgeId = $state<number | null>(null);
  let targetNameFilter = $state('');
  let page = $state(1);

  const artworks = getArtworksState();

  const lookupMaps = $derived.by(() => {
    const speciesById = new Map(
      data.lookups.monsterTypes.filter((row) => row.name).map((row) => [row.id, row.name as string] as const),
    );
    const frameById = new Map(data.lookups.cardFrameTypes.map((row) => [row.id, row.name] as const));
    return { speciesById, frameById };
  });

  const cardById = $derived(new Map(cards.map((c) => [c.id, c] as const)));
  const revealCard = $derived(revealId != null ? (cardById.get(revealId) ?? null) : null);

  const bridgeCandidates = $derived.by(() => {
    if (!revealCard) return [];
    return findExactBridges(revealCard, cards);
  });

  const clearTargetFilter = () => {
    targetNameFilter = '';
    page = 1;
  };

  const setRevealId = (next: number | null) => {
    revealId = next;
    clearTargetFilter();
    if (next == null) {
      bridgeId = null;
      return;
    }
    if (bridgeId == null) return;
    const reveal = cardById.get(next);
    const bridge = cardById.get(bridgeId);
    if (!reveal || !bridge || !isExactOneBridge(reveal, bridge)) {
      bridgeId = null;
    }
  };

  const setBridgeId = (next: number | null) => {
    bridgeId = next;
    clearTargetFilter();
  };

  const setTargetNameFilter = (next: string) => {
    targetNameFilter = next;
    page = 1;
  };

  const bridgeCard = $derived(bridgeId != null ? (cardById.get(bridgeId) ?? null) : null);

  const revealBridgeProps = $derived.by((): SmallWorldProperty[] => {
    if (!revealCard || !bridgeCard) return [];
    return getSharedProperties(revealCard, bridgeCard);
  });

  const targets = $derived.by(() => {
    if (!revealCard || !bridgeCard) return [];
    return findExactTargets(bridgeCard, cards, { excludeIds: [revealCard.id, bridgeCard.id] }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  });

  const filteredTargets = $derived.by(() => {
    const q = targetNameFilter.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((card) => card.name.toLowerCase().includes(q));
  });

  const filteredCount = $derived(filteredTargets.length);
  const totalPages = $derived(Math.max(1, Math.ceil(filteredCount / PAGE_SIZE)));
  const safePage = $derived(Math.min(page, totalPages));
  const visibleTargets = $derived(filteredTargets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE));
  const filterActive = $derived(targetNameFilter.trim().length > 0 && filteredCount < targets.length);
</script>

<Seo
  title="Small World Helper"
  description="Resolve Yu-Gi-Oh! Small World bridges: pick a reveal monster and a one-property bridge to find legal add targets from your deck."
  keywords="yugioh, ygo, small world, bridge, search, Yu-Gi-Oh!"
  author="AntiTcb" />

<div class="card mx-auto my-2 w-full max-w-3xl p-3 sm:p-4">
  <h1 class="h3 mb-2">Small World Helper</h1>
  <p class="mb-4 text-sm opacity-80">
    Reveal a monster from hand, then choose a deck monster that shares exactly one property (Type, Attribute, Level/Rank, ATK, or DEF). The tool lists monsters you can add that share exactly one property with that bridge.
  </p>

  <div class="flex flex-col gap-4">
    <MonsterCardPicker
      label="1. Reveal (hand)"
      testIdPrefix="smallworld-reveal"
      candidates={cards}
      bind:selectedId={
        () => revealId,
        (v) => setRevealId(v)
      }
      placeholder="Search reveal monster…"
      hint="Monster revealed by Small World from your hand." />

    <MonsterCardPicker
      label="2. Bridge (deck)"
      testIdPrefix="smallworld-bridge"
      candidates={bridgeCandidates}
      bind:selectedId={
        () => bridgeId,
        (v) => setBridgeId(v)
      }
      disabled={revealCard == null}
      placeholder="Search bridge monster…"
      hint={revealCard
        ? `${bridgeCandidates.length} exact one-property bridges for ${revealCard.name}.`
        : 'Select a reveal monster first.'} />

    {#if revealCard && bridgeCard && revealBridgeProps.length > 0}
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="opacity-70">Reveal → bridge shares:</span>
        {#each revealBridgeProps as prop (prop)}
          <span class="chip preset-filled-primary-500 text-xs" data-testid="smallworld-reveal-bridge-prop">
            {SMALL_WORLD_PROPERTY_LABELS[prop]}
          </span>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if revealCard && bridgeCard}
  <div class="flex flex-col gap-2 px-1">
    <label class="label flex max-w-md flex-col gap-1">
      <span class="label-text text-xs font-medium">Filter targets by name</span>
      <input
        class="input w-full text-sm"
        type="text"
        data-testid="smallworld-target-filter"
        placeholder="Search targets…"
        autocomplete="off"
        value={targetNameFilter}
        oninput={(e) => setTargetNameFilter(e.currentTarget.value)} />
    </label>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p class="text-sm" data-testid="smallworld-results-count">
        {filteredCount} targets{#if filterActive}<span class="opacity-60">{` (of ${targets.length})`}</span>{/if}
      </p>
    </div>
  </div>

  {@render resultsPaginator()}

  <div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
    {#each visibleTargets as card (card.id)}
      {@const stats = buildCardStatLine(card, lookupMaps)}
      {@const bridgeProp = card.shared[0]}
      <div class="card flex grow-0 flex-col items-center gap-2 space-y-0! p-3" data-testid="smallworld-card" data-card-id={card.id}>
        <img class="aspect-6/8.5 max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
        <article class="flex w-full grow flex-col gap-1">
          <p class="text-center text-sm font-bold" data-testid="smallworld-card-name">{card.name}</p>

          {#if bridgeProp}
            <p class="text-center">
              <span class="chip preset-tonal-surface text-xs" data-testid="smallworld-card-bridge-prop">
                {SMALL_WORLD_PROPERTY_LABELS[bridgeProp]}
              </span>
            </p>
          {/if}

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
      data-testid="smallworld-page-prev"
      disabled={safePage <= 1}
      onclick={() => (page = Math.max(1, safePage - 1))}>
      Prev
    </button>
    <span class="text-sm tabular-nums" data-testid="smallworld-page-label">Page {safePage} of {totalPages}</span>
    <button
      type="button"
      class="btn preset-tonal-surface btn-sm"
      data-testid="smallworld-page-next"
      disabled={safePage >= totalPages}
      onclick={() => (page = Math.min(totalPages, safePage + 1))}>
      Next
    </button>
  </div>
{/snippet}
