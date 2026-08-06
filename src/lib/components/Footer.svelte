<script lang="ts">
  import { page } from '$app/state';
  import { dragScroll } from '$lib/nav/dragScroll';
  import { getHorizontalScrollOverflow } from '$lib/nav/horizontalScrollOverflow';
  import { isNavActive } from '$lib/nav/isNavActive';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { Snippet } from 'svelte';
  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();

  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);

  const pathname = $derived(page.url.pathname);
  const homeActive = $derived(isNavActive(pathname, '/'));

  const trackOverflow: Attachment<HTMLElement> = (node) => {
    const update = () => {
      const next = getHorizontalScrollOverflow(node.scrollLeft, node.clientWidth, node.scrollWidth);
      canScrollLeft = next.canScrollLeft;
      canScrollRight = next.canScrollRight;
    };

    const scrollActiveIntoView = () => {
      const active = node.querySelector<HTMLElement>('[aria-current="page"]');
      active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
      update();
    };

    update();
    scrollActiveIntoView();
    node.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    const menu = node.querySelector<HTMLElement>('[data-part="menu"]');
    if (menu) observer.observe(menu);

    return () => {
      node.removeEventListener('scroll', update);
      observer.disconnect();
    };
  };
</script>

<Navigation
  layout="bar"
  class="mobile-nav sticky bottom-0 block bg-surface-950 lg:hidden"
  data-testid="mobile-nav"
>
  <div class="mobile-nav-frame relative min-w-0">
    <div
      class="mobile-nav-scroller min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain"
      data-testid="mobile-nav-scroller"
      {@attach trackOverflow}
      {@attach dragScroll}
    >
      <Navigation.Menu
        class="flex w-max min-w-full flex-nowrap items-center gap-1.5"
        data-testid="mobile-nav-menu"
      >
        <Navigation.TriggerAnchor
          href="/"
          class={homeActive ? 'nav-active' : ''}
          aria-current={homeActive ? 'page' : undefined}
        >
          <div class="flex flex-col items-center text-center">
            <HomeIcon class="size-[24px] md:size-6" />
            <Navigation.TriggerText class="text-sm">Home</Navigation.TriggerText>
          </div>
        </Navigation.TriggerAnchor>
        {@render children()}
      </Navigation.Menu>
    </div>

    {#if canScrollLeft}
      <div
        class="mobile-nav-fade mobile-nav-fade-left pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
        data-testid="mobile-nav-more-left"
        aria-hidden="true"
      ></div>
    {/if}

    {#if canScrollRight}
      <div
        class="mobile-nav-fade mobile-nav-fade-right pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
        data-testid="mobile-nav-more-right"
        aria-hidden="true"
      ></div>
    {/if}
  </div>
</Navigation>
