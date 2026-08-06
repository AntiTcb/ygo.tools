<script lang="ts">
  import { browser } from '$app/environment';
  import CardFilterBuilder from '$components/CardFilterBuilder.svelte';
  import RegexSearchField from '$components/RegexSearchField.svelte';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { evalRuleNode, type CardFilterRow } from '$lib/db/cardFilterEval';
  import { isStatFilterEmpty, resolveVirtualRuleTree, treeNeedsClientEval } from '$lib/db/cardFilterResolve';
  import { validateRuleLimits, type RuleNode } from '$lib/db/cardFilterRule';
  import { buildCardStatLine } from '$lib/db/cardStatDisplay';
  import { compileRegex } from '$lib/db/regexSearch';
  import { filterNeuronCardIds } from '$lib/rpc/filterCards.remote';
  import { searchSbCards } from '$lib/rpc/searchSupabaseCards.remote';
  import { useSearchParams } from 'runed/kit';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import type { PageProps } from './$types';
  import { databaseSearchParamsSchema } from './databaseSearchParams.schema';

  const MATERIAL_FRAME_TYPE_IDS = new Set([2, 3, 9, 10, 17, 18, 19, 22, 23, 34, 35, 39, 41, 47]);
  const DEBOUNCE_MS = 500;
  const STAT_DEBOUNCE_MS = 1000;
  const MAX_VISIBLE_RESULTS = 100;

  const siteFavicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  /** Plain-data snapshot — avoids structuredClone on Svelte `$state` proxies (DataCloneError on hydrate). */
  const cloneRuleTree = (t: RuleNode): RuleNode => JSON.parse(JSON.stringify(t)) as RuleNode;

  type Card = PageProps['data']['cards'][number];
  type SearchInput = {
    name: string;
    effectText: string;
    pendulumText: string;
    regexEffectSearch: boolean;
    regexPendulumSearch: boolean;
    regexEffectFlags: string;
    regexPendulumFlags: string;
    ruleTree: RuleNode;
  };

  type DebouncedText = Pick<
    SearchInput,
    'name' | 'effectText' | 'pendulumText' | 'regexEffectSearch' | 'regexPendulumSearch' | 'regexEffectFlags' | 'regexPendulumFlags'
  >;

  let { data }: PageProps = $props();
  const { cards } = $derived(data);

  const params = useSearchParams(databaseSearchParamsSchema, {
    pushHistory: false,
    debounce: 300,
    noScroll: true,
    compress: true,
  });

  /**
   * Stat filter drafts use nested `$bindable` mutation; Runed won't see those writes, so we mirror URL params locally and sync bidirectionally.
   */
  let ruleTree = $state<RuleNode>(cloneRuleTree(params.ruleDraft));
  let appliedRuleTree = $state<RuleNode>(cloneRuleTree(params.ruleApplied));

  /** Sync incoming URL/param trees onto local `$state`; `untrack` avoids clobbering in-progress drafts when unrelated params churn. */
  $effect(() => {
    if (!browser) return;
    const fromUrlDraft = params.ruleDraft;
    const fromUrlApplied = params.ruleApplied;
    const curDraftJson = JSON.stringify(fromUrlDraft);
    const curAppliedJson = JSON.stringify(fromUrlApplied);
    const localDraftSnapshot = JSON.stringify(untrack(() => cloneRuleTree(ruleTree)));
    const localAppliedSnapshot = JSON.stringify(untrack(() => cloneRuleTree(appliedRuleTree)));
    if (localDraftSnapshot !== curDraftJson) ruleTree = cloneRuleTree(fromUrlDraft);
    if (localAppliedSnapshot !== curAppliedJson) appliedRuleTree = cloneRuleTree(fromUrlApplied);
  });

  $effect(() => {
    if (!browser) return;
    JSON.stringify(ruleTree);
    JSON.stringify(appliedRuleTree);

    const nextDraft = cloneRuleTree(ruleTree);
    const nextApplied = cloneRuleTree(appliedRuleTree);
    if (JSON.stringify({ draft: params.ruleDraft, applied: params.ruleApplied }) === JSON.stringify({ draft: nextDraft, applied: nextApplied })) {
      return;
    }
    params.update({ ruleDraft: nextDraft, ruleApplied: nextApplied });
  });

  /**
   * Debounced name/effect. Stat rule tree is debounced into `appliedRuleTree` (see stat debounce effect).
   */
  let debouncedText = $state<DebouncedText>({
    name: '',
    effectText: '',
    pendulumText: '',
    regexEffectSearch: false,
    regexPendulumSearch: false,
    regexEffectFlags: '',
    regexPendulumFlags: '',
  });

  let debouncePrimed = $state(false);
  $effect(() => {
    const next: DebouncedText = {
      name: params.name,
      effectText: params.effectText,
      pendulumText: params.pendulumText,
      regexEffectSearch: params.regexEffectSearch,
      regexPendulumSearch: params.regexPendulumSearch,
      regexEffectFlags: params.regexEffectFlags,
      regexPendulumFlags: params.regexPendulumFlags,
    };

    if (!debouncePrimed) {
      debouncePrimed = true;
      debouncedText = next;
      return;
    }

    const handle = setTimeout(() => {
      debouncedText = next;
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  });

  /**
   * Push draft stat rules into the applied tree after `STAT_DEBOUNCE_MS` of stability.
   * Skip the first effect run so shareable URLs keep `ruleApplied` until the user edits stats.
   */
  let statRuleDebouncePrimed = $state(false);
  $effect(() => {
    if (!browser) return;
    JSON.stringify(ruleTree);
    if (!statRuleDebouncePrimed) {
      statRuleDebouncePrimed = true;
      return;
    }
    const handle = setTimeout(() => {
      appliedRuleTree = cloneRuleTree(ruleTree);
    }, STAT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  });

  const artworks = getArtworksState();

  const lookupMaps = $derived.by(() => {
    const speciesById = new Map<number, string>();
    for (const row of data.lookups.monsterTypes) {
      if (row.name) speciesById.set(row.id, row.name);
    }
    const frameById = new Map<number, string>();
    for (const row of data.lookups.complexFrameTypes) {
      frameById.set(row.id, row.name);
    }
    return { speciesById, frameById };
  });

  const matchesTextSlice = (haystack: string, needle: string, useRegex: boolean, regex: RegExp | null): boolean => {
    if (!needle) return true;
    if (useRegex) return regex ? regex.test(haystack) : false;
    return haystack.includes(needle);
  };

  const toRow = (card: Card): CardFilterRow => ({
    id: card.id,
    atk: card.atk,
    def: card.def,
    level: card.level,
    link_rating: card.link_rating,
    pend_scale_l: card.pend_scale_l,
    pend_scale_r: card.pend_scale_r,
    attribute_id: card.attribute_id,
    species_id: card.species_id,
    frame_type_id: card.frame_type_id,
    effect_id: card.effect_id,
    link_arrows: card.link_arrows,
    pendulum_text: card.pendulum_text,
  });

  const filterCards = async (search: SearchInput, cardList: Card[], lookups: PageProps['data']['lookups']) => {
    const trimmedName = search.name.trim();
    const nameActive = trimmedName.length > 0;
    const effectActive = search.effectText.length > 0;
    const pendulumActive = search.pendulumText.length > 0;
    const statActive = !isStatFilterEmpty(search.ruleTree);

    if (!nameActive && !effectActive && !pendulumActive && !statActive) {
      return [];
    }

    const lim = validateRuleLimits(search.ruleTree);
    if (!lim.ok) {
      toast.error(lim.message);
      return [];
    }

    const resolved = resolveVirtualRuleTree(search.ruleTree, lookups.complexFrameTypes);

    let statQuery: ReturnType<typeof filterNeuronCardIds> | null = null;
    let statClientEval = false;
    if (statActive) {
      const limResolved = validateRuleLimits(resolved);
      if (!limResolved.ok) {
        toast.error(limResolved.message);
        return [];
      }
      if (treeNeedsClientEval(resolved)) {
        statClientEval = true;
      } else {
        statQuery = filterNeuronCardIds(resolved);
      }
    }

    const nameQuery = nameActive ? searchSbCards(trimmedName) : null;

    let statIdSet: Set<number> | null = null;
    if (statActive) {
      if (statClientEval) {
        statIdSet = new Set(cardList.filter((c) => evalRuleNode(toRow(c), resolved)).map((c) => c.id));
      } else if (statQuery) {
        const r = await statQuery;
        if (r.error) {
          toast.error(`${r.error} — using offline stat filter on loaded cards.`);
          statIdSet = new Set(cardList.filter((c) => evalRuleNode(toRow(c), resolved)).map((c) => c.id));
        } else {
          statIdSet = new Set(r.ids);
        }
      }
    }

    const cardNameMatches = nameQuery ? await nameQuery : [];
    const cardNameIds = cardNameMatches?.map((x) => x.id) ?? [];
    const effectCompiled = search.regexEffectSearch && effectActive ? compileRegex(search.effectText, search.regexEffectFlags) : null;
    const pendCompiled = search.regexPendulumSearch && pendulumActive ? compileRegex(search.pendulumText, search.regexPendulumFlags) : null;
    const regexEffect = effectCompiled?.ok ? effectCompiled.regex : null;
    const regexPendulum = pendCompiled?.ok ? pendCompiled.regex : null;

    return cardList
      .filter((card) => {
        const matchesName = nameActive ? cardNameIds.includes(card.id) : true;
        const matchesFx = matchesTextSlice(card.effect_text ?? '', search.effectText, search.regexEffectSearch, regexEffect);
        const matchesPend = matchesTextSlice(card.pendulum_text ?? '', search.pendulumText, search.regexPendulumSearch, regexPendulum);
        const matchesStat = statActive ? (statIdSet?.has(card.id) ?? false) : true;
        return matchesName && matchesFx && matchesPend && matchesStat;
      })
      .sort((a, b) => {
        if (cardNameIds.length) {
          return cardNameIds.indexOf(a.id) - cardNameIds.indexOf(b.id);
        }
        return a.name.localeCompare(b.name);
      })
      .map((c) => ({
        ...c,
        materials: MATERIAL_FRAME_TYPE_IDS.has(c.frame_type_id ?? 0) ? (c.effect_text?.split('\n')[0] ?? null) : null,
      }));
  };

  const copy = (text: string) => {
    toast.promise(() => navigator.clipboard.writeText(text), {
      loading: 'Copying...',
      success: `Copied ${text}'s name to clipboard`,
      error: 'Failed to copy',
    });
  };

  type CardWithMaterials = Card & { materials: string | null };
  let displayedCards = $state<CardWithMaterials[]>([]);

  $effect(() => {
    const search: SearchInput = {
      ...debouncedText,
      ruleTree: appliedRuleTree,
    };
    const list = cards;
    const lookups = data.lookups;
    let cancelled = false;
    void filterCards(search, list, lookups).then((rows) => {
      if (!cancelled) displayedCards = rows;
    });
    return () => {
      cancelled = true;
    };
  });

  const visibleCards = $derived(displayedCards.slice(0, MAX_VISIBLE_RESULTS));
  const showingCapped = $derived(displayedCards.length > MAX_VISIBLE_RESULTS);
</script>

<div class="card mx-auto my-2 w-full p-3 sm:p-4">
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
    <div class="flex flex-col gap-4">
      <label class="label flex flex-col gap-1">
        <span class="label-text text-xs font-medium">Card name</span>
        <input class="input w-full text-sm" type="text" data-testid="database-search-name" bind:value={params.name} placeholder="Search by name…" />
      </label>

      <RegexSearchField
        label="Effect text"
        testIdPrefix="database-search-effect"
        bind:pattern={
          () => params.effectText,
          (v) => {
            params.effectText = v;
          }
        }
        bind:useRegex={
          () => params.regexEffectSearch,
          (v) => {
            params.regexEffectSearch = v;
          }
        }
        bind:flags={
          () => params.regexEffectFlags,
          (v) => {
            params.regexEffectFlags = v;
          }
        }
        placeholder="e.g. destroy.*monster  or  /negate.*activation/i" />

      <RegexSearchField
        label="Pendulum text"
        testIdPrefix="database-search-pendulum"
        bind:pattern={
          () => params.pendulumText,
          (v) => {
            params.pendulumText = v;
          }
        }
        bind:useRegex={
          () => params.regexPendulumSearch,
          (v) => {
            params.regexPendulumSearch = v;
          }
        }
        bind:flags={
          () => params.regexPendulumFlags,
          (v) => {
            params.regexPendulumFlags = v;
          }
        }
        placeholder="Pendulum effect text…" />
    </div>

    <aside class="border-surface-500/30 flex max-h-[min(70vh,52rem)] min-h-0 flex-col gap-2 overflow-y-auto rounded-md border p-3">
      <div class="shrink-0">
        <h2 class="text-sm font-semibold">Stat filters</h2>
        <p class="text-xs opacity-60">Applies after {STAT_DEBOUNCE_MS / 1000}s idle</p>
      </div>
      <CardFilterBuilder bind:ruleTree lookups={data.lookups} />
    </aside>
  </div>
</div>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
  <p class="text-sm" data-testid="database-results-count">
    {displayedCards.length} results{#if showingCapped}
      <span class="opacity-60"> (showing first {MAX_VISIBLE_RESULTS})</span>
    {/if}
  </p>
  <label class="label mb-0 inline-flex cursor-pointer items-center gap-2 p-0 text-sm">
    <input type="checkbox" class="checkbox" data-testid="database-hide-effect-text" bind:checked={params.hideEffectText} />
    Hide effect and pendulum text
  </label>
</div>

<div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
  {#each visibleCards as card (card.id)}
    {@const stats = buildCardStatLine(card, lookupMaps)}
    <div class="card flex grow-0 flex-col items-center gap-2 space-y-0! p-3" data-testid="database-card" data-card-id={card.id}>
      <button type="button" class="cursor-copy" onclick={() => copy(card.name)}>
        <img class="aspect-6/8.5 max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
      </button>
      <article class="flex w-full grow flex-col gap-1">
        <button type="button" class="cursor-copy text-center text-sm font-bold" data-testid="database-card-name" onclick={() => copy(card.name)}
          >{card.name}</button>

        <div class="text-center text-xs leading-snug opacity-85" data-testid="database-card-stats">
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

        {#if card.materials && !params.hideEffectText}
          <p class="text-center text-[0.7rem] italic opacity-70">{card.materials}</p>
        {/if}
        <p class="max-h-72 overflow-y-auto text-xs leading-snug opacity-90" class:hidden={params.hideEffectText} data-testid="database-card-effect">
          {#each (card.effect_text ?? '').split('\n') as line, lineIdx (lineIdx)}
            {#if lineIdx > 0}<br />{/if}{line}
          {/each}
        </p>
        {#if card.pendulum_text}
          <p
            class="border-surface-500/20 mt-1 max-h-48 overflow-y-auto border-t pt-1 text-xs leading-snug opacity-90"
            class:hidden={params.hideEffectText}
            data-testid="database-card-pendulum">
            <span class="font-semibold">Pendulum: </span>
            {#each card.pendulum_text.split('\n') as line, lineIdx (lineIdx)}
              {#if lineIdx > 0}<br />{/if}{line}
            {/each}
          </p>
        {/if}
      </article>
      <nav class="border-surface-500/20 flex w-full items-center justify-center gap-1 border-t pt-2" aria-label="External card links">
        <a
          class="hover:bg-surface-500/15 inline-flex size-8 items-center justify-center rounded transition-colors"
          href={`https://yugipedia.com/wiki/${encodeURIComponent(card.name)}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Yugipedia"
          aria-label="Open {card.name} on Yugipedia">
          <img class="size-5" src={siteFavicon('yugipedia.com')} alt="" width="24" height="24" loading="lazy" />
        </a>
        <a
          class="hover:bg-surface-500/15 inline-flex size-8 items-center justify-center rounded transition-colors"
          href={`https://db.ygoresources.com/card#${card.id}`}
          target="_blank"
          rel="noopener noreferrer"
          title="YGOResources"
          aria-label="Open {card.name} on YGOResources">
          <img class="size-5" src={siteFavicon('db.ygoresources.com')} alt="" width="24" height="24" loading="lazy" />
        </a>
        <a
          class="hover:bg-surface-500/15 inline-flex size-8 items-center justify-center rounded transition-colors"
          href={`https://partner.tcgplayer.com/antitcb?subId2=ygotools&u=${encodeURIComponent(`https://shop.tcgplayer.com/yugioh/product/show?newSearch=false&IsProductNameExact=false&ProductName=${card.name}&Type=Cards&orientation=list`)}`}
          target="_blank"
          rel="noopener noreferrer"
          title="TCGPlayer"
          aria-label="Search {card.name} on TCGPlayer">
          <img class="size-5" src={siteFavicon('tcgplayer.com')} alt="" width="24" height="24" loading="lazy" />
        </a>
      </nav>
    </div>
  {/each}
</div>
