<script lang="ts">
  import { page } from '$app/stores';
  import { Nav } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet<[]> } = $props();

  let value = $state('');

  $effect(() => {
    value = $page.url.pathname.replace('/', '');
  });
</script>

<Nav.Bar
  bind:value
  classes="sticky bottom-0 lg:hidden block"
  height="max-h-24"
  tilesClasses="max-w-24 max-h-28 h-28"
  background="bg-surface-950"
  tilesItems="items-center"
  tilesJustify="justify-start">
  {@render children()}
</Nav.Bar>
