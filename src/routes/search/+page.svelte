<script lang="ts">
  import { afterNavigate, goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { describeQueryTarget, encodeQuery, isNamedCard, SELF, TIERS, type SearchQuery, type Tier } from '$lib/effect-search/query';
  import Seo from 'sk-seo';

  let { data } = $props();
  const artworks = getArtworksState();

  // A fresh parse put the query in `data`; write it into the URL so the link replays without the model.
  // replaceState throws until the router is initialized, which happens just after the first
  // afterNavigate callbacks run, hence the timeout.
  afterNavigate(() => {
    if (!data.parsedFresh || !data.ast || page.url.searchParams.has('ast')) return;
    const url = new URL(page.url);
    url.searchParams.set('ast', data.ast);
    setTimeout(() => replaceState(url, page.state));
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
    const url = new URL(page.url);
    url.searchParams.set('ast', encodeQuery(next));
    void goto(url, { keepFocus: true, noScroll: true });
  };

  const toggleZone = (zone: string) => {
    if (!data.query) return;
    const zones = data.query.from_zones.includes(zone) ? data.query.from_zones.filter((z) => z !== zone) : [...data.query.from_zones, zone];
    edit({ from_zones: zones });
  };

  const verbsFor = (mode: SearchQuery['mode']) => (mode === 'does' ? data.vocab.actionVerbs : data.vocab.eventVerbs);

  let targetName = $state('');
  $effect.pre(() => {
    targetName = data.query?.target && isNamedCard(data.query.target) && data.query.target.card !== SELF ? data.query.target.card : '';
  });

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

  const grouped = $derived.by(() => {
    if (data.response?.kind !== 'results') return [];
    return TIERS.map((tier) => ({ tier, hits: data.response!.kind === 'results' ? data.response!.hits.filter((h) => h.tier === tier) : [] })).filter(
      (g) => g.hits.length,
    );
  });

  const noticeText: Record<string, string> = {
    rate_limited: 'Too many searches in a short time. Wait a minute, or edit the query below (edits don’t count).',
    unavailable: 'Search parsing is unavailable right now.',
    parse_failed: "Couldn't turn that into a query. Showing a plain text search instead.",
    unsupported: "That doesn't look like a question about card effects. Showing a plain text search instead.",
    bad_link: 'That search link is invalid or out of date. Try searching again.',
  };
</script>

<Seo
  title="Effect Search"
  description="Search Yu-Gi-Oh! cards by what their effects do, in plain English: “cards that can Special Summon Toadally Awesome from the GY”."
  keywords="yugioh, ygo, effect search, card search, natural language, Yu-Gi-Oh!"
  author="AntiTcb" />

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
        <form
          class="flex items-end gap-1"
          onsubmit={(e) => {
            e.preventDefault();
            edit({ target: targetName.trim() ? { card: targetName.trim() } : null });
          }}>
          <label class="flex flex-col text-xs">
            {data.query.mode === 'does' ? 'Applies to card' : 'Happens to card'}
            <input class="input w-56 text-sm" bind:value={targetName} placeholder={describeQueryTarget(data.query.target)} />
          </label>
          <button class="btn preset-tonal-surface btn-sm" type="submit">Set</button>
        </form>
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
      <div class="flex flex-wrap gap-1 text-xs">
        {#if data.query.target && !(isNamedCard(data.query.target) && data.query.target.card !== SELF)}
          <button type="button" class="chip preset-tonal-surface" onclick={() => edit({ target: null })}
            >✕ {describeQueryTarget(data.query.target)}</button>
        {/if}
        {#if data.query.card_filter}
          <button type="button" class="chip preset-tonal-surface" onclick={() => edit({ card_filter: null })}
            >✕ only {describeQueryTarget(data.query.card_filter)}s</button>
        {/if}
        {#if data.query.cause_card}
          <button type="button" class="chip preset-tonal-surface" onclick={() => edit({ cause_card: null })}
            >✕ caused by {describeQueryTarget(data.query.cause_card)}</button>
        {/if}
        {#if data.query.cause}
          <button type="button" class="chip preset-tonal-surface" onclick={() => edit({ cause: null })}>✕ by {data.query.cause}</button>
        {/if}
        {#if data.query.from_side}
          <button type="button" class="chip preset-tonal-surface" onclick={() => edit({ from_side: null })}
            >✕ {data.query.from_side === 'you' ? 'your' : data.query.from_side === 'opponent' ? "opponent's" : 'either'} side</button>
        {/if}
      </div>
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
    <p class="px-1 text-sm opacity-80" data-testid="search-count">
      {data.response.total} cards{#if data.response.truncated}&nbsp;(showing the first {data.response.hits.length}){/if}
    </p>
    {#each grouped as group (group.tier)}
      <details class="card p-3" open={group.tier !== 'unrestricted' || grouped.length === 1}>
        <summary class="cursor-pointer">
          <span class="h5">{tierInfo[group.tier].title}</span>
          <span class="text-sm opacity-70"> · {group.hits.length}</span>
          {#if tierInfo[group.tier].blurb}<p class="text-xs opacity-70">{tierInfo[group.tier].blurb}</p>{/if}
        </summary>
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
                <a class="anchor font-semibold" href="/database?name={encodeURIComponent(hit.card.name)}">{hit.card.name}</a>
                {#each hit.reasons as r, i (i)}
                  <p class="text-sm">{r.snippet}</p>
                  <p class="font-mono text-xs opacity-70">
                    {r.why}{#if r.note}&nbsp;— depends: {r.note}{/if}
                  </p>
                {/each}
              </div>
            </li>
          {/each}
        </ul>
      </details>
    {/each}
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
