<script lang="ts">
  import { enhance } from '$app/forms';
  import { refreshAll } from '$app/navigation';
  import { onMount } from 'svelte';

  let { data, form } = $props();

  // Refresh while a run is in progress.
  onMount(() => {
    const timer = setInterval(() => {
      if (data.runs.some((r) => r.status === 'running')) void refreshAll();
    }, 15_000);
    return () => clearInterval(timer);
  });

  const pct = (done: number, failed: number, total: number) => (total ? Math.round(((done + failed) / total) * 100) : 0);
  const duration = (start: string, end: string | null) => {
    const ms = (end ? Date.parse(end) : Date.now()) - Date.parse(start);
    return ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)} min`;
  };
</script>

<svelte:head>
  <title>Runs · Admin · ygo.tools</title>
</svelte:head>

<section class="card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
  <p>
    <span class="font-semibold">{data.queued}</span> cards queued (<span class="font-semibold">{data.retagRequests}</span> re-tag requests). An hourly cron
    starts a run when there's work.
  </p>
  <form method="POST" action="?/runNow" use:enhance>
    <button class="btn preset-filled-primary-500 btn-sm" type="submit" disabled={!data.canRun}>Run now</button>
  </form>
</section>
{#if form}
  <section class="card p-2 text-sm {'error' in form ? 'preset-tonal-error' : 'preset-tonal-success'}">
    {'error' in form ? form.error : form.message}
  </section>
{/if}

<section class="card flex flex-col gap-2 p-3">
  {#each data.runs as run (run.id)}
    {@const p = pct(run.cards_done, run.cards_failed, run.cards_total)}
    <div class="border-surface-500/20 flex flex-col gap-1 border-b py-2 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">#{run.id}</span>
        <span
          class="chip text-xs {run.status === 'running'
            ? 'preset-tonal-primary'
            : run.status === 'failed'
              ? 'preset-tonal-error'
              : 'preset-tonal-success'}">{run.status}</span>
        <span>{run.kind}{run.source ? ` · ${run.source} ${run.version}` : ''}</span>
        <span class="text-xs opacity-70">{new Date(run.started_at).toLocaleString()} · {duration(run.started_at, run.finished_at)}</span>
        <span class="text-xs opacity-70">{run.model ?? ''}{run.prompt_version ? ` · prompt ${run.prompt_version}` : ''}</span>
      </div>
      <div class="flex items-center gap-2">
        <progress class="progress h-2 flex-1" value={p} max="100"></progress>
        <span class="text-xs tabular-nums">{run.cards_done} done · {run.cards_failed} failed / {run.cards_total}</span>
      </div>
      {#if run.error}<p class="text-error-500 text-xs">{run.error}</p>{/if}
    </div>
  {:else}
    <p class="text-sm opacity-70">No runs yet.</p>
  {/each}
</section>
