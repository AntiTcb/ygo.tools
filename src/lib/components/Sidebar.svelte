<script lang="ts">
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';
  import HomeIcon from '~icons/mdi/home';

  let { children }: { children: Snippet<[]> } = $props();
</script>

<Navigation
  layout="rail"
  class="sticky top-0 col-span-1 hidden h-screen lg:block"
>
  <Navigation.Header>
    <Navigation.TriggerAnchor href="/">
      <div class="flex flex-col items-center text-center">
        <HomeIcon class="size-[24px] md:size-6" />
        <Navigation.TriggerText class="text-sm">Home</Navigation.TriggerText>
      </div>
    </Navigation.TriggerAnchor>
  </Navigation.Header>
  <Navigation.Content>
    <Navigation.Menu class="justify-start gap-2 p-2">
      {@render children()}
    </Navigation.Menu>
  </Navigation.Content>
</Navigation>
