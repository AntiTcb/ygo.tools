<script lang="ts">
  import { page } from '$app/state';
  import { isNavActive } from '$lib/nav/isNavActive';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';
  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();

  const pathname = $derived(page.url.pathname);
  const homeActive = $derived(isNavActive(pathname, '/'));
</script>

<Navigation layout="rail" class="sticky top-0 col-span-1 hidden h-screen lg:block" data-testid="desktop-nav">
  <Navigation.Header>
    <Navigation.TriggerAnchor href="/" class={homeActive ? 'nav-active' : ''} aria-current={homeActive ? 'page' : undefined}>
      <div class="flex flex-col items-center text-center">
        <HomeIcon class="size-[24px] md:size-6" />
        <Navigation.TriggerText class="text-sm text-wrap whitespace-normal">Home</Navigation.TriggerText>
      </div>
    </Navigation.TriggerAnchor>
  </Navigation.Header>
  <Navigation.Content>
    <Navigation.Menu class="justify-start gap-2">
      {@render children()}
    </Navigation.Menu>
  </Navigation.Content>
</Navigation>
