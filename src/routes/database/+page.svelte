<script lang="ts">
  import { browser } from '$app/environment';
  import CardFilterBuilder from '$components/CardFilterBuilder.svelte';
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { evalRuleNode, type CardFilterRow } from '$lib/db/cardFilterEval';
  import { isStatFilterEmpty, resolveVirtualRuleTree, treeNeedsClientEval } from '$lib/db/cardFilterResolve';
  import { validateRuleLimits, type RuleNode } from '$lib/db/cardFilterRule';
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

  /** Letters allowed in `new RegExp(pattern, flags)` across supported engines. */
  const normalizeRegexFlags = (raw: string): string =>
    [...raw.toLowerCase()]
      .filter((c) => 'dgimsuvy'.includes(c))
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .join('');

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

  /** Delimiter form `/pat/flags` uses only embedded flags; otherwise uses `extraFlags`. */
  const stringToRegex = (str: string, extraFlags: string): RegExp | null => {
    const match = str.match(/^([\/~@;%#'])(.*?)\1([a-z]*)$/i);

    try {
      if (match) {
        const flags = normalizeRegexFlags(match[3] ?? '');
        return new RegExp(match[2] ?? '', flags);
      }
      return new RegExp(str, normalizeRegexFlags(extraFlags));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Invalid regex pattern:', message);
      return null;
    }
  };

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
      console.debug('no filters');
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
          //   if (r.truncated) {
          //     toast.warning(`Stat filter hit the ${REMOTE_ID_CAP.toLocaleString()} result cap; refine filters for full accuracy.`);
          //   }
          statIdSet = new Set(r.ids);
        }
      }
    }

    const cardNameMatches = nameQuery ? await nameQuery : [];
    const cardNameIds = cardNameMatches?.map((x) => x.id) ?? [];
    const regexEffect = search.regexEffectSearch && effectActive ? stringToRegex(search.effectText, search.regexEffectFlags) : null;
    const regexPendulum = search.regexPendulumSearch && pendulumActive ? stringToRegex(search.pendulumText, search.regexPendulumFlags) : null;

    console.debug({
      trimmedName,
      cardNameMatches,
      cardNameIds,
      regexEffect,
      regexPendulum,
      statIdSet,
    });

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

  const regexEffectFlagsPreview = $derived(params.regexEffectSearch ? normalizeRegexFlags(params.regexEffectFlags) || '—' : '');

  const regexPendulumFlagsPreview = $derived(params.regexPendulumSearch ? normalizeRegexFlags(params.regexPendulumFlags) || '—' : '');
</script>

<div class="card mx-auto my-2 w-full p-3 sm:p-4">
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto] lg:items-start lg:gap-x-4">
    <div class="flex flex-col gap-1 lg:col-start-1 lg:row-start-1">
      <span class="label-text text-xs">Card name</span>
      <input class="input w-full text-sm" type="text" data-testid="database-search-name" bind:value={params.name} />
    </div>

    <div class="flex flex-col gap-1.5 lg:col-start-1 lg:row-start-2">
      <span class="label-text text-xs">Effect</span>
      <input class="input w-full text-sm" type="text" data-testid="database-search-effect" bind:value={params.effectText} />
      <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
        <label class="label mb-0 flex cursor-pointer items-center gap-2 p-0">
          <input class="checkbox" type="checkbox" data-testid="database-regex-effect" bind:checked={params.regexEffectSearch} />
          <span class="text-sm">Regex</span>
        </label>
        <label class="label mb-0 max-w-28 min-w-18 shrink-0 p-0" class:opacity-40={!params.regexEffectSearch}>
          <span class="label-text text-xs">Flags</span>
          <input
            class="input w-full font-mono text-sm"
            type="text"
            data-testid="database-regex-effect-flags"
            bind:value={params.regexEffectFlags}
            disabled={!params.regexEffectSearch}
            placeholder="im"
            maxlength={16}
            title="Effect RegExp flags: d g i m s u v y. Delimiter patterns (/pat/flags) use embedded flags only." />
        </label>
      </div>
      {#if params.regexEffectSearch}
        <p class="text-xs opacity-80">
          Effect active flags:
          <code class="bg-surface-500/15 rounded px-1">{regexEffectFlagsPreview}</code>
          <span class="opacity-70"> — delimiter forms ignore this box.</span>
        </p>
      {/if}
    </div>

    <div class="flex flex-col gap-1.5 lg:col-start-1 lg:row-start-3">
      <span class="label-text text-xs">Pendulum</span>
      <input
        class="input w-full text-sm"
        type="text"
        data-testid="database-search-pendulum"
        bind:value={params.pendulumText}
        placeholder="Pendulum monster text…" />
      <div class="flex flex-wrap items-end gap-x-3 gap-y-1">
        <label class="label mb-0 flex cursor-pointer items-center gap-2 p-0">
          <input class="checkbox" type="checkbox" data-testid="database-regex-pendulum" bind:checked={params.regexPendulumSearch} />
          <span class="text-sm">Regex</span>
        </label>
        <label class="label mb-0 max-w-28 min-w-18 shrink-0 p-0" class:opacity-40={!params.regexPendulumSearch}>
          <span class="label-text text-xs">Flags</span>
          <input
            class="input w-full font-mono text-sm"
            type="text"
            data-testid="database-regex-pendulum-flags"
            bind:value={params.regexPendulumFlags}
            disabled={!params.regexPendulumSearch}
            placeholder="im"
            maxlength={16}
            title="Pendulum RegExp flags: d g i m s u v y. Delimiter patterns (/pat/flags) use embedded flags only." />
        </label>
      </div>
      {#if params.regexPendulumSearch}
        <p class="text-xs opacity-80">
          Pendulum active flags:
          <code class="bg-surface-500/15 rounded px-1">{regexPendulumFlagsPreview}</code>
          <span class="opacity-70"> — delimiter forms ignore this box.</span>
        </p>
      {/if}
    </div>

    <aside
      class="border-surface-500/30 flex max-h-[min(70vh,52rem)] min-h-0 flex-col gap-2 overflow-y-auto rounded border p-2 lg:col-start-2 lg:row-span-3 lg:row-start-1">
      <div class="shrink-0 text-sm font-semibold">
        Stat filters
        <span class="pl-1 text-xs font-normal opacity-70">(apply after {STAT_DEBOUNCE_MS / 1000}s idle)</span>
      </div>
      <CardFilterBuilder bind:ruleTree lookups={data.lookups} />
    </aside>
  </div>
</div>

<p class="px-1 text-sm" data-testid="database-results-count">{displayedCards.length} results</p>
<label class="label inline-flex cursor-pointer items-center gap-2 px-1 text-sm">
  <input type="checkbox" bind:checked={params.hideEffectText} />
  Hide effect and pendulum text
</label>
<div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
  {#each visibleCards as card (card.id)}
    <div class="card flex grow-0 flex-col items-center">
      <button type="button" class="cursor-copy" onclick={() => copy(card.name)}>
        <img class="aspect-6/8.5 max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
      </button>
      <article class="grow">
        <button type="button" class="cursor-copy text-center font-bold" onclick={() => copy(card.name)}>{card.name}</button>
        <p class="max-h-72 overflow-y-auto text-sm" class:hidden={params.hideEffectText}>
          {@html card.effect_text?.replaceAll('\n', '<br />')}
        </p>
        {#if card.pendulum_text}
          <p class="border-surface-500/20 mt-1 max-h-48 overflow-y-auto border-t pt-1 text-xs opacity-90" class:hidden={params.hideEffectText}>
            <span class="font-semibold">Pendulum: </span>
            {@html card.pendulum_text.replaceAll('\n', '<br />')}
          </p>
        {/if}
      </article>
      <div class="flex flex-wrap justify-between gap-2 self-stretch text-sm">
        <a href={`https://yugipedia.com/wiki/${card.name}`} target="_blank">Yugipedia</a>
        <a href={`https://db.ygoresources.com/card#${card.id}`} target="_blank">YGOResources</a>
        <a
          href={`https://partner.tcgplayer.com/antitcb?subId2=ygotools&u=${encodeURIComponent(`https://shop.tcgplayer.com/yugioh/product/show?newSearch=false&IsProductNameExact=false&ProductName=${card.name}&Type=Cards&orientation=list`)}`}
          target="_blank">TCGPlayer</a>
      </div>
    </div>
  {/each}
</div>
