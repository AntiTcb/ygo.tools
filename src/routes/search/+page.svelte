<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getArtworksState } from '#lib/assets/yugiohArtwork.svelte.js';
  import { encodeQuery, TIERS, type SearchQuery, type Tier } from '#lib/effect-search/query.js';
  import { FACETS, SORTS, writeView, type Facet, type ResultView, type Sort } from '#lib/effect-search/resultView.js';
  import { cleanTarget, pickedFrom, pickedTarget, type PickedTarget } from '#lib/effect-search/targetEdit.js';
  import { describeTarget } from '#lib/effect-search/targetRule.js';
  import TargetPicker from './TargetPicker.svelte';

  let { data } = $props();
  const artworks = getArtworksState();

  // A fresh parse put the query in `data`; write it into the URL so the link replays without the model.
  // Shallow navigation throws until the router is initialized, which happens just after the first
  // afterNavigate callbacks run, hence the timeout. The shallow navigation runs afterNavigate again, so write
  // each parsed query once.
  let written: string | null = null;
  afterNavigate(() => {
    if (!data.parsedFresh || !data.ast || written === data.ast || page.url.searchParams.has('ast')) return;
    written = data.ast;
    const url = new URL(page.url.href);
    url.searchParams.set('ast', data.ast);
    setTimeout(() => goto(url, { state: page.state, shallow: true, replace: true }));
  });

  let request = $state('');
  $effect.pre(() => {
    request = data.q;
  });

  const examples = [
    'cards that can special summon Toadally Awesome from the GY',
    "monsters that trigger when sent to the GY as a cost for a WATER monster's effect",
    'spells that banish from the opponent graveyard',
    'level 4 or lower monsters that special summon themselves from the hand',
  ];

  /** Re-run with an edited query (no model call: the edited query goes in `ast`). */
  const edit = (patch: Partial<SearchQuery>) => {
    if (!data.query) return;
    const next = { ...data.query, ...patch };
    const url = new URL(page.url.href);
    url.searchParams.set('ast', encodeQuery(next));
    url.searchParams.delete('page');
    void goto(url, { reset: false });
  };

  /** Re-show the results with other filters, sort or page. Pages scroll back to the top; the rest keep the scroll. */
  const setView = (patch: Partial<ResultView>) => {
    if (!data.ast) return;
    const url = new URL(page.url.href);
    url.searchParams.set('ast', data.ast);
    void goto(writeView(url, { ...data.view, page: 1, ...patch }), { reset: 'page' in patch });
  };

  const toggleFacet = (facet: Facet, value: string) => {
    const values = data.view.filters[facet];
    setView({ filters: { ...data.view.filters, [facet]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value] } });
  };

  const facetTitle: Record<Facet, string> = { kind: 'Card', attribute: 'Attribute', race: 'Type', archetype: 'Archetype' };
  const sortLabel: Record<Sort, string> = { relevance: 'Best match', name: 'Name', atk: 'ATK', def: 'DEF', level: 'Level/Rank/Link' };
  const anyFilter = $derived(Object.values(data.view.filters).some((v) => v.length));

  const toggleZone = (zone: string) => {
    if (!data.query) return;
    const zones = data.query.from_zones.includes(zone) ? data.query.from_zones.filter((z) => z !== zone) : [...data.query.from_zones, zone];
    edit({ from_zones: zones });
  };

  const verbsFor = (mode: SearchQuery['mode']) => (mode === 'does' ? data.vocab.actionVerbs : data.vocab.eventVerbs);

  // The editable card slots of the query.
  const targetSlot = $derived(pickedFrom(data.query?.target ?? null, data.query?.mode === 'responds_to' && data.query.subject_is_self === true));
  const causeSlot = $derived(pickedFrom(data.query?.cause_card ?? null));
  const filterSlot = $derived(pickedFrom(data.query?.card_filter ?? null));

  const slotSummary = (p: PickedTarget, selfText = 'the card itself') =>
    p.kind === 'any' ? 'any card' : p.kind === 'self' ? selfText : p.kind === 'card' ? `"${p.card}"` : describeTarget(p.target);

  const tierInfo: Record<Tier, { title: string; blurb: string }> = {
    name: { title: 'Names it', blurb: 'The effect names the card you asked about.' },
    self: { title: 'Does it to itself', blurb: 'The card you asked about does this to itself.' },
    property: { title: 'Fits the restrictions', blurb: "The effect's restrictions (Type, Attribute, Level/Rank, archetype, …) allow it." },
    contextual: {
      title: 'Possibly, depending on game state',
      blurb: 'The restrictions fit, but the effect also depends on what is happening in the duel.',
    },
    partial: { title: 'Fits some of them', blurb: "The effect's restrictions only allow some of the cards you described." },
    unrestricted: { title: 'Any card', blurb: 'The effect has no relevant restriction, so it works on this too.' },
    match: { title: 'Matches', blurb: '' },
  };

  /** Best-match order shows the page grouped by tier; other sorts show one list (the tier labels each hit). */
  const grouped = $derived.by(() => {
    const r = data.response;
    if (r?.kind !== 'results') return [];
    if (r.sort !== 'relevance') return [{ tier: null, hits: r.hits }];
    return TIERS.map((tier) => ({ tier, hits: r.hits.filter((h) => h.tier === tier) })).filter((g) => g.hits.length);
  });

  const noticeText: Record<string, string> = {
    rate_limited: 'Too many searches in a short time. Wait a minute, or edit the query below (edits don’t count).',
    unavailable: 'Search parsing is unavailable right now.',
    parse_failed: "Couldn't turn that into a query. Showing a plain text search instead.",
    unsupported: "That doesn't look like a question about card effects. Showing a plain text search instead.",
    bad_link: 'That search link is invalid or out of date. Try searching again.',
  };
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-3">
  <section class="card flex flex-col gap-2 p-3 sm:p-4">
    <h1 class="h3">Effect Search</h1>
    <p class="text-sm opacity-80">Describe what a card's effect should do. Results come from AI-tagged card effects and can be wrong.</p>
    <form method="GET" class="flex gap-2">
      <input
        class="input w-full"
        name="q"
        bind:value={request}
        placeholder="cards that can special summon Toadally Awesome from the GY"
        maxlength="300" />
      <button class="btn preset-filled-primary-500" type="submit">Search</button>
    </form>
    {#if !data.q && !data.query}
      <div class="flex flex-wrap gap-1 text-xs">
        {#each examples as ex (ex)}
          <a class="chip preset-tonal-surface" href="?q={encodeURIComponent(ex)}">{ex}</a>
        {/each}
      </div>
    {/if}
  </section>

  {#if data.notice}
    <section class="card preset-tonal-warning p-3 text-sm">
      {noticeText[data.notice]}{#if data.unsupportedReason}&nbsp;({data.unsupportedReason}){/if}
    </section>
  {/if}

  {#if data.query}
    <section class="card flex flex-col gap-2 p-3 text-sm" data-testid="search-query">
      <p class="font-semibold">{data.description}</p>
      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col text-xs">
          Effect
          <select class="select text-sm" value={data.query.mode} onchange={(e) => edit({ mode: e.currentTarget.value as SearchQuery['mode'] })}>
            <option value="does">does</option>
            <option value="responds_to">responds to</option>
          </select>
        </label>
        <label class="flex flex-col text-xs">
          Verb
          <select class="select text-sm" value={data.query.verb} onchange={(e) => edit({ verb: e.currentTarget.value })}>
            {#each verbsFor(data.query.mode) as v (v)}<option value={v}>{v.replaceAll('_', ' ')}</option>{/each}
          </select>
        </label>
        {#if data.query.mode === 'does'}
          <label class="flex flex-col text-xs">
            Cost
            <select
              class="select text-sm"
              value={data.query.is_cost === null ? 'any' : String(data.query.is_cost)}
              onchange={(e) => edit({ is_cost: e.currentTarget.value === 'any' ? null : e.currentTarget.value === 'true' })}>
              <option value="any">either</option>
              <option value="true">only as a cost</option>
              <option value="false">not as a cost</option>
            </select>
          </label>
        {/if}
        {#if data.query.mode === 'responds_to'}
          <label class="flex flex-col text-xs">
            Caused by
            <select
              class="select text-sm"
              value={data.query.cause ?? 'any'}
              onchange={(e) => edit({ cause: e.currentTarget.value === 'any' ? null : (e.currentTarget.value as SearchQuery['cause']) })}>
              <option value="any">anything</option>
              <option value="cost">a cost</option>
              <option value="effect">an effect</option>
              <option value="battle">battle</option>
              <option value="material">use as material</option>
            </select>
          </label>
        {/if}
        <label class="flex flex-col text-xs">
          Side
          <select
            class="select text-sm"
            value={data.query.from_side ?? 'any'}
            onchange={(e) => edit({ from_side: e.currentTarget.value === 'any' ? null : (e.currentTarget.value as SearchQuery['from_side']) })}>
            <option value="any">any</option>
            <option value="you">yours</option>
            <option value="opponent">opponent's</option>
            <option value="either">either player's</option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-1 text-xs">
        <span class="opacity-70">From:</span>
        {#each data.vocab.zones as z (z)}
          <button
            type="button"
            class="chip {data.query.from_zones.includes(z) ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
            onclick={() => toggleZone(z)}>{z.replaceAll('_', ' ')}</button>
        {/each}
      </div>
      {#if data.query.mode === 'does'}
        <TargetPicker
          label="Applies to"
          summary={slotSummary(targetSlot, 'the card itself')}
          value={targetSlot}
          kinds={['any', 'self', 'card', 'described']}
          selfLabel="the card itself"
          archetypes={data.archetypes}
          idPrefix="target"
          onchange={(p) => edit({ target: pickedTarget(p) })} />
      {:else}
        <TargetPicker
          label="Happens to"
          summary={slotSummary(targetSlot, 'the card itself')}
          value={targetSlot}
          kinds={['any', 'self', 'card', 'described']}
          selfLabel="the card itself"
          archetypes={data.archetypes}
          idPrefix="target"
          onchange={(p) => edit(p.kind === 'self' ? { subject_is_self: true, target: null } : { subject_is_self: null, target: pickedTarget(p) })} />
        <TargetPicker
          label="Caused by card"
          summary={slotSummary(causeSlot)}
          value={causeSlot}
          kinds={['any', 'card', 'described']}
          archetypes={data.archetypes}
          idPrefix="cause"
          onchange={(p) => edit({ cause_card: pickedTarget(p) })} />
      {/if}
      <TargetPicker
        label="Only show"
        summary={filterSlot.kind === 'described' ? `${describeTarget(filterSlot.target)}s` : 'all cards'}
        value={filterSlot}
        kinds={['any', 'described']}
        archetypes={data.archetypes}
        idPrefix="filter"
        onchange={(p) => edit({ card_filter: p.kind === 'described' ? cleanTarget(p.target) : null })} />
    </section>
  {/if}

  {#if data.response?.kind === 'unknown_card'}
    {@const field = data.response.field}
    <section class="card flex flex-col gap-2 p-3 text-sm" data-testid="search-did-you-mean">
      <p>No card is named "{data.response.name}". Did you mean:</p>
      <div class="flex flex-wrap gap-1">
        {#each data.response.suggestions as s (s.id)}
          <button type="button" class="chip preset-tonal-primary" onclick={() => edit({ [field]: { card: s.name } })}>{s.name}</button>
        {:else}
          <span class="opacity-70">no close matches.</span>
        {/each}
      </div>
    </section>
  {:else if data.response?.kind === 'results'}
    {@const res = data.response}
    {#if res.total}
      <section class="card flex flex-col gap-2 p-3 text-xs" data-testid="search-refine">
        {#each FACETS as facet (facet)}
          {@const values = res.facets[facet]}
          {#if values.length > 1 || values.some((v) => v.selected)}
            <div class="flex flex-wrap items-baseline gap-1">
              <span class="w-20 shrink-0 opacity-70">{facetTitle[facet]}:</span>
              {#if facet === 'archetype'}
                {#each values.filter((v) => v.selected) as v (v.value)}
                  <button type="button" class="chip preset-filled-primary-500" onclick={() => toggleFacet(facet, v.value)}
                    >✕ {v.value} ({v.count})</button>
                {/each}
                {#if values.some((v) => !v.selected)}
                  <select
                    class="select w-auto py-0 text-xs"
                    aria-label="Add an archetype filter"
                    value=""
                    onchange={(e) => e.currentTarget.value && toggleFacet(facet, e.currentTarget.value)}>
                    <option value="">add…</option>
                    {#each values.filter((v) => !v.selected) as v (v.value)}<option value={v.value}>{v.value} ({v.count})</option>{/each}
                  </select>
                {/if}
              {:else}
                {#each values as v (v.value)}
                  <button
                    type="button"
                    class="chip {v.selected ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
                    aria-pressed={v.selected}
                    onclick={() => toggleFacet(facet, v.value)}>{v.value} <span class="opacity-70">{v.count}</span></button>
                {/each}
              {/if}
            </div>
          {/if}
        {/each}
      </section>
    {/if}
    <div class="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
      <p class="opacity-80" data-testid="search-count">
        {#if anyFilter}{res.matching} of {res.total} cards
          <button type="button" class="anchor ml-1 text-xs" onclick={() => setView({ filters: { kind: [], attribute: [], race: [], archetype: [] } })}
            >clear filters</button
          >{:else}{res.total} cards{/if}
      </p>
      <label class="flex items-center gap-1 text-xs">
        Sort
        <select class="select w-auto py-0 text-xs" value={res.sort} onchange={(e) => setView({ sort: e.currentTarget.value as Sort })}>
          {#each SORTS as s (s)}<option value={s}>{sortLabel[s]}</option>{/each}
        </select>
      </label>
    </div>
    {#each grouped as group (group.tier)}
      <details class="card p-3" open={group.tier !== 'unrestricted' || grouped.length === 1}>
        {#if group.tier}
          <summary class="cursor-pointer">
            <span class="h5">{tierInfo[group.tier].title}</span>
            <span class="text-sm opacity-70"> · {group.hits.length}</span>
            {#if tierInfo[group.tier].blurb}<p class="text-xs opacity-70">{tierInfo[group.tier].blurb}</p>{/if}
          </summary>
        {:else}
          <summary class="cursor-pointer"><span class="h5">Sorted by {sortLabel[res.sort]}</span></summary>
        {/if}
        <ul class="mt-2 flex flex-col gap-2">
          {#each group.hits as hit (hit.card.id)}
            <li class="border-surface-500/20 flex gap-3 border-t pt-2" data-testid="search-hit">
              {#if artworks?.getArtwork(hit.card.id)?.bestArt}
                <img
                  class="aspect-6/8.5 w-14 shrink-0 self-start"
                  src={artworks.getArtwork(hit.card.id)?.bestArt}
                  alt={hit.card.name}
                  loading="lazy" />
              {/if}
              <div class="flex min-w-0 flex-col gap-1">
                <div>
                  <a class="anchor font-semibold" href="/database?name={encodeURIComponent(hit.card.name)}">{hit.card.name}</a>
                  {#if !group.tier}<span class="chip preset-tonal-surface ml-1 py-0 text-[0.65rem]">{tierInfo[hit.tier].title}</span>{/if}
                  <p class="text-xs opacity-70">{hit.card.typeLine}</p>
                </div>
                {#each hit.reasons as r, i (i)}
                  <p class="text-sm">{r.snippet}</p>
                  <p class="text-xs opacity-70">
                    <span class="font-semibold">Matched:</span>
                    {r.why}.{#if r.note}&nbsp;Depends on game state: {r.note}.{/if}
                  </p>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
    {#if res.pageCount > 1}
      <nav class="flex items-center justify-center gap-2 text-sm" aria-label="Result pages" data-testid="search-pages">
        <button type="button" class="btn preset-tonal-surface btn-sm" disabled={res.page <= 1} onclick={() => setView({ page: res.page - 1 })}
          >Previous</button>
        <span>Page {res.page} of {res.pageCount}</span>
        <button
          type="button"
          class="btn preset-tonal-surface btn-sm"
          disabled={res.page >= res.pageCount}
          onclick={() => setView({ page: res.page + 1 })}>Next</button>
      </nav>
    {/if}
  {/if}

  {#if data.textResults.length}
    <section class="card flex flex-col gap-2 p-3 text-sm">
      <h2 class="h5">Cards whose text mentions those words</h2>
      <ul class="flex flex-wrap gap-x-3 gap-y-1">
        {#each data.textResults as c (c.id)}<li><a class="anchor" href="/database?name={encodeURIComponent(c.name)}">{c.name}</a></li>{/each}
      </ul>
    </section>
  {/if}
</div>
