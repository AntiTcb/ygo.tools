<script lang="ts">
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { searchCards } from '$lib/db/supabase';
  import Search from 'svelte-search';
  import CopyIcon from '~icons/lucide/copy';

  let { data } = $props();

  let cardNameIds: any[] = $state([]);
  let searchState = $state({
    name: '',
    effectText: '',
    regexEffectSearch: false,
    hideEffectText: false,
  });

  const artworks = getArtworksState();

  const stringToRegex = (str: string): RegExp | null => {
    const match = str.match(/^([\/~@;%#'])(.*?)\1([gimsuy]*)$/);

    if (match) {
      try {
        return new RegExp(
          match[2] ?? '',
          match[3]
            ?.split('')
            .filter((char, pos, flagArr) => flagArr.indexOf(char) === pos)
            .join('') ?? '',
        );
      } catch (error: any) {
        console.error('Invalid regex pattern:', error.message);
        return null;
      }
    }

    try {
      return new RegExp(str);
    } catch (error: any) {
      console.error('Invalid regex pattern:', error.message);
      return null;
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    .then(() => alert('Copied to clipboard'));
  };

  let cards = $derived.by(() => {
    const regex = searchState.regexEffectSearch ? stringToRegex(searchState.effectText) : null;

    if (!searchState.name && !searchState.effectText) {
      return [];
    }

    return data.cards
      .filter((card) => {
        const effectText = card.effect_text ?? '';

        const matchesName = searchState.name ? cardNameIds.includes(card.id) : true;

        let matchesEffectText = true;
        if (searchState.effectText) {
          if (searchState.regexEffectSearch && regex) {
            matchesEffectText = regex.test(effectText);
          } else if (!searchState.regexEffectSearch) {
            matchesEffectText = effectText.includes(searchState.effectText);
          } else {
            matchesEffectText = false;
          }
        }

        return matchesName && matchesEffectText;
      })
      .sort((a, b) => {
        if (cardNameIds.length) {
          return cardNameIds.indexOf(a.id) - cardNameIds.indexOf(b.id);
        }
        return a.name.localeCompare(b.name);
      })
      .map((c) => ({
        ...c,
        materials: [2, 3, 9, 10, 17, 18, 19, 22, 23, 34, 35, 39, 41, 47].includes(c.frame_type_id ?? 0) ? c.effect_text?.split('\n')[0] : null,
      }));
  });

  $effect(() => {
    searchCards(searchState.name).then((result) => {
      cardNameIds = result.data?.map((x) => x.id) ?? [];
    });
  });
</script>

<div class="card mx-auto my-2 w-full space-y-4">
  <label class="label">
    <Search class="input" debounce={500} on:type={(e) => (searchState.name = e.detail)} on:clear={() => (searchState.name = '')}>
      <span class="label-text" slot="label">Card Name</span>
    </Search>
  </label>
  <label class="label">
    <Search class="input" debounce={500} on:type={(e) => (searchState.effectText = e.detail)} on:clear={() => (searchState.effectText = '')}>
      <span class="label-text" slot="label">Effect</span>
    </Search>
    <label for="regex" class="label flex items-center space-x-2">
      <input class="checkbox" type="checkbox" name="regex" bind:checked={searchState.regexEffectSearch} />
      <p>RegEx mode</p>
    </label>
  </label>
</div>

<p>{cards.length} results</p>
<input type="checkbox" bind:checked={searchState.hideEffectText} /> Hide effect text
<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
  {#each cards.slice(0, 1000) as card}
    <div class="card flex flex-grow-0 flex-col items-center">
      <img class="aspect-[6/8.5] max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
      <article>
        <button type="button" class="text-center font-bold cursor-copy" onclick={() =>
        copy(card.name)}>{card.name}</button>
        <p class="max-h-72 overflow-y-auto text-sm" class:hidden={searchState.hideEffectText}>
          {@html card.effect_text?.replaceAll('\n', '<br />')}
        </p>
      </article>
    </div>
  {/each}
</div>
