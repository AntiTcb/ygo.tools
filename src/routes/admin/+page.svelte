<script lang="ts">
  let { data } = $props();

  const stateClass: Record<string, string> = {
    untagged: 'preset-tonal-surface',
    tagged: 'preset-tonal-success',
    locked: 'preset-tonal-primary',
    draft: 'preset-tonal-warning',
  };
</script>

<svelte:head>
  <title>Admin · ygo.tools</title>
</svelte:head>

<section class="card grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-6">
  {#each [['Tagged', data.stats.tagged], ['Queued', data.stats.queued], ['Locked', data.stats.locked], ['Drafts to review', data.stats.drafts], ['Gold cards', data.stats.gold], ['Pending suggestions', data.stats.pendingSuggestions]] as [label, value] (label)}
    <div class="flex flex-col">
      <span class="text-xs opacity-60">{label}</span>
      <span class="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  {/each}
</section>

<section class="card flex flex-col gap-2 p-3">
  <form method="GET" class="flex gap-2">
    <input class="input w-full text-sm" name="q" value={data.q} placeholder="Find a card by name" autocomplete="off" />
    <button class="btn preset-filled-primary-500 btn-sm" type="submit">Search</button>
  </form>
  {#if data.q && !data.results.length}
    <p class="text-sm opacity-70">No cards match "{data.q}".</p>
  {/if}
  <ul class="flex flex-col">
    {#each data.results as card (card.id)}
      <li class="border-surface-500/20 flex items-center justify-between gap-2 border-b py-1 text-sm">
        <a class="anchor" href="/admin/cards/{card.id}">{card.name}</a>
        <span class="chip text-xs {stateClass[card.state]}">{card.state}</span>
      </li>
    {/each}
  </ul>
</section>

<section class="card flex flex-col gap-2 p-3">
  <h2 class="h5">Recent tagging runs</h2>
  {#if !data.runs.length}
    <p class="text-sm opacity-70">No runs yet. Start one with <code class="code">pnpm effect-search:backfill</code>.</p>
  {:else}
    <table class="table text-sm">
      <thead>
        <tr><th>Started</th><th>Kind</th><th>Status</th><th>Model</th><th class="text-right">Done / failed / total</th></tr>
      </thead>
      <tbody>
        {#each data.runs as run (run.id)}
          <tr>
            <td>{new Date(run.started_at).toLocaleString()}</td>
            <td>{run.kind}</td>
            <td title={run.error ?? ''}>{run.status}</td>
            <td class="text-xs">{run.model ?? '—'}</td>
            <td class="text-right tabular-nums">{run.cards_done} / {run.cards_failed} / {run.cards_total}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
