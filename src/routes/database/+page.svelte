<script lang="ts">
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { searchCards } from '$lib/db/supabase';
  import Search from 'svelte-search';
  import { toast } from 'svelte-sonner';

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
    toast.promise(() => navigator.clipboard.writeText(text), {
      loading: 'Copying...',
      success: `Copied ${text}'s name to clipboard`,
      error: 'Failed to copy',
    });
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
    const asyncEffect = async () => {
      const c = await searchCards(searchState.name);
      cardNameIds = c.data?.map((x) => x.id) ?? [];
    };
    asyncEffect();
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
<div class="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
  {#each cards.slice(0, 1000) as card}
    <div class="card flex grow-0 flex-col items-center">
      <button type="button" class="cursor-copy" onclick={() => copy(card.name)}>
        <img class="aspect-[6/8.5] max-h-60" src={artworks.getArtwork(card.id)?.bestArt} alt={card.name} />
      </button>
      <article class="grow">
        <button type="button" class="cursor-copy text-center font-bold" onclick={() => copy(card.name)}>{card.name}</button>
        <p class="max-h-72 overflow-y-auto text-sm" class:hidden={searchState.hideEffectText}>
          {@html card.effect_text?.replaceAll('\n', '<br />')}
        </p>
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
