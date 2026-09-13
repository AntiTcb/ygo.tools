<script lang="ts">
  import { getArtworksState } from '$lib/assets/yugiohArtwork.svelte.js';
  import { HOME_HELPER_TILES, HOME_TOOL_TILES } from '$lib/home/homeTiles';
  import Seo from 'sk-seo';
  import CalculatorIcon from 'virtual:icons/mdi/calculator';
  import DatabaseIcon from '~icons/mdi/database-search';

  const artworks = getArtworksState();
  const helperTiles = $derived(
    HOME_HELPER_TILES.map((tile) => ({
      ...tile,
      art: artworks.getArtwork(tile.cardId)?.bestArt,
    })),
  );

  const toolIcon = (href: string) => {
    if (href === '/damagecalc') return CalculatorIcon;
    return DatabaseIcon;
  };
</script>

<Seo
  title="YGO Tools"
  description="A collection of tools for Yu-Gi-Oh! players to become the greatest duelists"
  keywords="yugioh, ygo, tools, Yu-Gi-Oh!"
  author="AntiTcb" />

<div class="flex flex-col gap-6">
  <section data-testid="home-tools">
    <h2 class="h4 mb-2">Tools</h2>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {#each HOME_TOOL_TILES as tile (tile.href)}
        {@const Icon = toolIcon(tile.href)}
        <a
          href={tile.href}
          data-testid="home-tool-tile"
          class="card border-surface-200-800 divide-surface-200-800 preset-filled-surface-100-900 flex h-full flex-col overflow-hidden border">
          <article class="flex h-full flex-col space-y-2 p-4">
            <h5 class="h5 flex shrink-0 flex-nowrap justify-between">
              {tile.title}
              <Icon class="inline size-[32px] min-w-[28px] hue-rotate-90" />
            </h5>
            <p class="opacity-70">{tile.description}</p>
          </article>
        </a>
      {/each}
    </div>
  </section>

  <section data-testid="home-card-helpers">
    <h2 class="h4 mb-2">Card Helpers</h2>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {#each helperTiles as tile (tile.href)}
        <a
          href={tile.href}
          data-testid="home-helper-tile"
          data-helper-href={tile.href}
          class="card border-surface-200-800 preset-filled-surface-100-900 flex h-full overflow-hidden border">
          {#if tile.art}
            <img class="aspect-6/8.5 h-28 shrink-0 object-cover" src={tile.art} alt={tile.cardName} data-testid="home-helper-art" />
          {:else}
            <span class="bg-surface-500/20 aspect-6/8.5 h-28 shrink-0" aria-hidden="true"></span>
          {/if}
          <article class="flex min-w-0 flex-col justify-center space-y-2 p-4">
            <h5 class="h5">{tile.title}</h5>
            <p class="opacity-70">{tile.description}</p>
          </article>
        </a>
      {/each}
    </div>
  </section>
</div>
