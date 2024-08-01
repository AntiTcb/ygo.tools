<script>
  import Footer from '$components/Footer.svelte';
  import Header from '$components/Header.svelte';
  import Sidebar from '$components/Sidebar.svelte';
  import { Nav } from '@skeletonlabs/skeleton-svelte';
  import CalculatorIcon from 'virtual:icons/mdi/calculator';
  import '../app.postcss';

  let { children } = $props();
</script>

<!-- <main class="container mx-auto h-full space-y-4 p-4 sm:p-6 lg:space-y-6"> -->
<div class="grid grid-cols-[1fr] bg-surface-800 lg:grid-cols-[auto_1fr]">
  <Sidebar>
    {@render NavTiles()}
  </Sidebar>

  <main>
    <Header />
    <section class="p-2">
      {@render children()}
    </section>
  </main>
</div>
<Footer>
  {@render NavTiles()}
</Footer>

{#snippet NavTiles()}
  <Nav.Tile href="/damagecalc" id="damagecalc">
    <div class="flex flex-col items-center text-center">
      <CalculatorIcon class="h-[32px] w-[32px]" />
      <span class="text-sm">Damage Calculator</span>
    </div>
  </Nav.Tile>
{/snippet}
