<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/suggestions', label: 'Suggestions' },
    { href: '/admin/vocab', label: 'Vocabulary' },
    { href: '/admin/runs', label: 'Runs' },
  ];
  const active = (href: string) => (href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href));
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-3">
  <div class="flex flex-wrap items-center justify-between gap-2 px-1">
    <div class="flex flex-wrap items-baseline gap-3">
      <span class="h4">Effect search admin</span>
      {#if page.url.pathname !== '/admin/login'}
        <nav class="flex flex-wrap gap-1">
          {#each links as link (link.href)}
            <a class="btn btn-sm {active(link.href) ? 'preset-filled-primary-500' : 'preset-tonal-surface'}" href={link.href}>{link.label}</a>
          {/each}
        </nav>
      {/if}
    </div>
    {#if page.url.pathname !== '/admin/login'}
      <form method="POST" action="/admin/login?/logout">
        <button class="btn preset-tonal-surface btn-sm" type="submit">Sign out</button>
      </form>
    {/if}
  </div>
  {@render children()}
</div>
