<script lang="ts">
  import { page } from '$app/state';
  import Footer from '$components/Footer.svelte';
  import Header from '$components/Header.svelte';
  import Sidebar from '$components/Sidebar.svelte';
  import { setArtworksState } from '$lib/assets/yugiohArtwork.svelte';
  import { isNavActive } from '$lib/nav/isNavActive';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { Toaster } from 'svelte-sonner';
  import CalculatorIcon from 'virtual:icons/mdi/calculator';
  import DatabaseIcon from '~icons/mdi/database-search';
  import EarthIcon from '~icons/mdi/earth';
  import '../app.css';

  let { children } = $props();

  let currentPage = $derived.by(() => page.url.pathname);

  const artworks = setArtworksState();

  const navClass = (href: string) => (isNavActive(currentPage, href) ? 'nav-active' : '');
  const navCurrent = (href: string) => (isNavActive(currentPage, href) ? 'page' : undefined);
</script>

<div class="bg-surface-800 grid grid-cols-[1fr] lg:grid-cols-[auto_1fr]">
  {#if currentPage !== '/'}
    <Sidebar>
      {@render NavTiles()}
    </Sidebar>
  {/if}

  <main class="min-h-screen" class:col-span-2={currentPage === '/'}>
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
  <Navigation.TriggerAnchor href="/damagecalc" class={navClass('/damagecalc')} aria-current={navCurrent('/damagecalc')}>
    <div class="flex flex-col items-center text-center">
      <CalculatorIcon class="size-6 md:size-7" />
      <Navigation.TriggerText class="text-sm text-wrap whitespace-normal">Damage Calculator</Navigation.TriggerText>
    </div>
  </Navigation.TriggerAnchor>
  <Navigation.TriggerAnchor href="/database" class={navClass('/database')} aria-current={navCurrent('/database')}>
    <div class="flex flex-col items-center justify-center text-center">
      <DatabaseIcon class="size-6 md:size-7" />
      <Navigation.TriggerText class="text-sm text-wrap whitespace-normal">Card Search</Navigation.TriggerText>
    </div>
  </Navigation.TriggerAnchor>
  <Navigation.TriggerAnchor href="/smallworld" class={navClass('/smallworld')} aria-current={navCurrent('/smallworld')}>
    <div class="flex flex-col items-center justify-center text-center">
      <EarthIcon class="size-6 md:size-7" />
      <Navigation.TriggerText class="text-sm text-wrap whitespace-normal">Small World</Navigation.TriggerText>
    </div>
  </Navigation.TriggerAnchor>
{/snippet}
