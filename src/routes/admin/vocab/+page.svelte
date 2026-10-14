<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  type Row = (typeof data.verbs)[number] | (typeof data.zones)[number];
  const isVerb = (r: Row): r is (typeof data.verbs)[number] => 'usable_as_action' in r;
  const termName = (rows: Row[], id: number | null) => rows.find((r) => r.id === id)?.term ?? '?';
</script>

<svelte:head>
  <title>Vocabulary · Admin · ygo.tools</title>
</svelte:head>

<section class="card p-3 text-sm opacity-80">
  The tagger's prompt and output schema are built from these terms. Renaming keeps stored tags (they reference the id); retiring a term re-tags every
  card that uses it with the replacement available instead.
</section>

{#snippet table(kind: 'verb' | 'zone', rows: Row[])}
  <section class="card flex flex-col gap-2 p-3">
    <h2 class="h5">{kind === 'verb' ? 'Verbs (actions and trigger events)' : 'Zones'}</h2>
    {#each rows as row (row.id)}
      <div class="border-surface-500/20 flex flex-col gap-1 border-b py-2 text-sm {row.retired_at ? 'opacity-50' : ''}">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono font-semibold">{row.term}</span>
          <span class="text-xs opacity-70">{row.actions} actions · {row.triggers} triggers</span>
          {#if row.retired_at}<span class="chip preset-tonal-surface text-xs">retired → {termName(rows, row.replaced_by)}</span>{/if}
        </div>
        {#if form && 'key' in form && form.key === `${kind}:${row.id}`}
          <p class="text-xs {'error' in form ? 'text-error-500' : 'text-success-500'}">{'error' in form ? form.error : form.message}</p>
        {/if}
        {#if !row.retired_at}
          <form method="POST" action="?/update" use:enhance class="flex flex-wrap items-end gap-2">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="current_term" value={row.term} />
            <input class="input w-44 font-mono text-xs" name="term" value={row.term} aria-label="Term" />
            <input class="input min-w-64 flex-1 text-xs" name="description" value={row.description} aria-label="Description" />
            {#if isVerb(row)}
              <label class="flex items-center gap-1 text-xs"
                ><input type="checkbox" class="checkbox" name="as_action" checked={row.usable_as_action} /> action</label>
              <label class="flex items-center gap-1 text-xs"
                ><input type="checkbox" class="checkbox" name="as_event" checked={row.usable_as_event} /> event</label>
            {/if}
            <button class="btn preset-tonal-primary btn-sm" type="submit">Save</button>
          </form>
          <form method="POST" action="?/retire" use:enhance class="flex items-end gap-2">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={row.id} />
            <select class="select w-44 text-xs" name="replacement_id" aria-label="Replacement" required>
              <option value="" disabled selected>Retire, replaced by…</option>
              {#each rows.filter((r) => r.id !== row.id && !r.retired_at) as r (r.id)}<option value={r.id}>{r.term}</option>{/each}
            </select>
            <button class="btn preset-tonal-surface btn-sm" type="submit">Retire</button>
          </form>
        {/if}
      </div>
    {/each}
  </section>
{/snippet}

{@render table('verb', data.verbs)}
{@render table('zone', data.zones)}
