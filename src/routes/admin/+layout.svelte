<script lang="ts">
  let { data, children } = $props();
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-3">
  <div class="flex flex-wrap items-baseline justify-between gap-2 px-1">
    <a href="/admin" class="h4">Effect search admin</a>
    <span class="text-xs opacity-60">{data.adminEmail}</span>
  </div>
  {@render children()}
</div>
