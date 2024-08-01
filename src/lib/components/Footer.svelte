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

<Nav.Bar bind:value classes="sticky bottom-0 lg:hidden block" height="max-h-32" tilesClasses="max-w-24" background="bg-surface-950">
  {@render children()}
</Nav.Bar>
