<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Suggestions · Admin · ygo.tools</title>
</svelte:head>

<section class="card flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
  <p>
    <span class="font-semibold">{data.totalSuggestions}</span> pending suggestions in
    <span class="font-semibold">{data.totalClusters}</span> groups{#if data.unclustered}
      &nbsp;({data.unclustered} not clustered yet: the next tagging run groups them){/if}.
  </p>
  <p class="opacity-70">Approving or merging queues the affected cards for re-tagging on the next run.</p>
</section>

{#each data.clusters as c (`${c.kind}:${c.key}`)}
  <section class="card flex flex-col gap-2 p-3 text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <span class="font-mono font-semibold">{c.key}</span>
      <span class="chip preset-tonal-surface text-xs">{c.kind}</span>
      {#if c.kind === 'verb'}
        {#if c.asAction}<span class="chip preset-tonal-surface text-xs">action</span>{/if}
        {#if c.asEvent}<span class="chip preset-tonal-surface text-xs">event</span>{/if}
      {/if}
      <span class="text-xs opacity-70">{c.occurrences} cards · {c.ids.length} proposals</span>
      {#if c.matchesExisting}<span class="chip preset-tonal-warning text-xs">same name as an existing term: merge?</span>{/if}
    </div>
    {#if c.terms.length > 1 || c.terms[0] !== c.key}
      <p class="text-xs opacity-70">Proposed as: {c.terms.join(', ')}</p>
    {/if}
    {#if c.description}<p class="text-xs">{c.description}</p>{/if}
    <ul class="list-inside list-disc text-xs opacity-80">
      {#each c.phrases as p (p)}<li>"{p}"</li>{/each}
    </ul>
    <p class="flex flex-wrap gap-1 text-xs">
      {#each c.exampleCardIds as id (id)}
        <a class="anchor" href="/admin/cards/{id}">{data.cardNames[id] ?? `#${id}`}</a>
      {/each}
    </p>

    {#if form && 'key' in form && form.key === `${c.kind}:${c.key}`}
      <p class="text-xs {'error' in form ? 'text-error-500' : 'text-success-500'}">{'error' in form ? form.error : form.message}</p>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
      <form method="POST" action="?/approve" use:enhance class="flex flex-wrap items-end gap-2">
        <input type="hidden" name="ids" value={c.ids.join(',')} />
        <input type="hidden" name="kind" value={c.kind} />
        <input type="hidden" name="key" value={`${c.kind}:${c.key}`} />
        <label class="flex flex-col text-xs">
          Term
          <input class="input w-48 font-mono text-xs" name="term" value={c.key} required />
        </label>
        <label class="flex flex-col text-xs">
          Description (the tagger reads this)
          <input class="input w-80 text-xs" name="description" value={c.description ?? ''} required />
        </label>
        {#if c.kind === 'verb'}
          <label class="flex items-center gap-1 text-xs"
            ><input type="checkbox" class="checkbox" name="as_action" checked={c.asAction || !c.asEvent} /> action</label>
          <label class="flex items-center gap-1 text-xs"><input type="checkbox" class="checkbox" name="as_event" checked={c.asEvent} /> event</label>
        {/if}
        <button class="btn preset-filled-primary-500 btn-sm" type="submit">Approve</button>
      </form>

      <form method="POST" action="?/merge" use:enhance class="flex items-end gap-2">
        <input type="hidden" name="ids" value={c.ids.join(',')} />
        <input type="hidden" name="kind" value={c.kind} />
        <input type="hidden" name="key" value={`${c.kind}:${c.key}`} />
        <label class="flex flex-col text-xs">
          Merge into
          <select class="select w-44 text-xs" name="term_id" required>
            {#each c.kind === 'verb' ? data.verbs : data.zones as t (t.id)}
              <option value={t.id} selected={t.term === c.key}>{t.term}</option>
            {/each}
          </select>
        </label>
        <button class="btn preset-tonal-primary btn-sm" type="submit">Merge</button>
      </form>

      <form method="POST" action="?/reject" use:enhance>
        <input type="hidden" name="ids" value={c.ids.join(',')} />
        <input type="hidden" name="key" value={`${c.kind}:${c.key}`} />
        <button class="btn preset-tonal-surface btn-sm" type="submit">Reject</button>
      </form>
    </div>
  </section>
{:else}
  <section class="card p-3 text-sm opacity-70">No pending suggestions.</section>
{/each}

{#if data.pages > 1}
  <nav class="flex items-center justify-center gap-3 py-2 text-sm">
    {#if data.page > 1}<a class="btn preset-tonal-surface btn-sm" href="?page={data.page - 1}">Previous</a>{/if}
    <span class="tabular-nums">Page {data.page} of {data.pages}</span>
    {#if data.page < data.pages}<a class="btn preset-tonal-surface btn-sm" href="?page={data.page + 1}">Next</a>{/if}
  </nav>
{/if}
