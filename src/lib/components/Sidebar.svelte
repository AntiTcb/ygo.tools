<script lang="ts">
  import { page } from '$app/stores';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';
  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();

  let value = $state('');

  $effect(() => {
    value = $page.url.pathname.replace('/', '');
  });
</script>

<Navigation.Rail
  bind:value
  tilesJustify="justify-start"
  tilesClasses="p-2"
  classes="sticky top-0 col-span-1 hidden lg:block"
  padding="p-0"
  height="h-screen">
  {#snippet header()}
    <Navigation.Tile href="/" id="">
      <div class="flex flex-col items-center text-center">
        <HomeIcon class="size-[24px]" />
        <span class="text-sm">Home</span>
      </div>
    </Navigation.Tile>
  {/snippet}
  {#snippet tiles()}
    {@render children()}
  {/snippet}
</Navigation.Rail>
