<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-3">
  <div class="flex flex-wrap items-baseline justify-between gap-2 px-1">
    <a href="/admin" class="h4">Effect search admin</a>
    {#if page.url.pathname !== '/admin/login'}
      <form method="POST" action="/admin/login?/logout">
        <button class="btn preset-tonal-surface btn-sm" type="submit">Sign out</button>
      </form>
    {/if}
  </div>
  {@render children()}
</div>
