<script lang="ts">
  import { page } from '$app/stores';
  import { Nav } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';
  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();

  let value = $state('');

  $effect(() => {
    value = $page.url.pathname.replace('/', '');
  });
</script>

<Nav.Rail
  bind:value
  tilesJustify="justify-start"
  tilesClasses="p-2"
  classes="sticky top-0 col-span-1 hidden lg:block"
  padding="p-0"
  height="h-screen">
  {#snippet header()}
    <Nav.Tile href="/" id="">
      <div class="flex flex-col items-center text-center">
        <HomeIcon class="size-[24px]" />
        <span class="text-sm">Home</span>
      </div>
    </Nav.Tile>
  {/snippet}
  {#snippet tiles()}
    {@render children()}
  {/snippet}
</Nav.Rail>
