<script lang="ts">
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';

  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();
</script>

<Navigation layout="bar" class="sticky bottom-0 block bg-surface-950 lg:hidden">
    <Navigation.Menu class="grid grid-cols-3 ">
        <Navigation.TriggerAnchor href="/">
          <div class="flex flex-col items-center text-center">
            <HomeIcon class="size-[24px] md:size-6" />
            <Navigation.TriggerText class="text-sm">Home</Navigation.TriggerText>
          </div>
        </Navigation.TriggerAnchor>
    {@render children()}
  </Navigation.Menu>
</Navigation>
