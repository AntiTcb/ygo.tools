<script>
  import { page } from '$app/stores';
  import Footer from '$components/Footer.svelte';
  import Header from '$components/Header.svelte';
  import Sidebar from '$components/Sidebar.svelte';
  import { setArtworksState } from '$lib/assets/yugiohArtwork.svelte';
  import { Nav } from '@skeletonlabs/skeleton-svelte';
  import { Toaster } from 'svelte-sonner';
  import CalculatorIcon from 'virtual:icons/mdi/calculator';
  import DatabaseIcon from '~icons/mdi/database-search';
  import '../app.postcss';

  let { children } = $props();

  let currentPage = $derived.by(() => $page.url.pathname);

  const artworks = setArtworksState();
</script>

<div class="grid grid-cols-[1fr] bg-surface-800 lg:grid-cols-[auto_1fr]">
  {#if currentPage !== '/'}
    <Sidebar>
      {@render NavTiles()}
    </Sidebar>
  {/if}

  <main class="min-h-[100vh]" class:col-span-2={currentPage === '/'}>
    <Header />
    <section class="p-2">
      {@render children()}
    </section>
  </main>
</div>
{#if currentPage !== '/'}
  <Footer>
    {@render NavTiles()}
  </Footer>
{/if}

<Toaster />

{#snippet NavTiles()}
  <Nav.Tile href="/damagecalc" id="damagecalc">
    <div class="flex flex-col items-center text-center">
      <CalculatorIcon class="size-[24px] md:size-[32px]" />
      <span class="text-sm">Damage Calculator</span>
    </div>
  </Nav.Tile>
  <Nav.Tile href="/database" id="database">
    <div class="flex flex-col items-center text-center">
      <DatabaseIcon class="size-[24px] md:size-[32px]" />
      <span class="text-sm">Database</span>
    </div>
  </Nav.Tile>
{/snippet}
