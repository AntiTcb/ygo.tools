<script lang="ts">
  import { enhance } from '$app/forms';
  import { describeAction, describeTrigger } from '$lib/effect-search/describe';
  import type { TagOutput } from '$lib/effect-search/tagSchema';

  let { data, form } = $props();

  const pretty = (o: TagOutput | null) => JSON.stringify(o ?? { effects: [], unmapped: [] }, null, 2);

  // Reset the editor whenever the loaded tags change (navigation or a successful save); keep the
  // submitted text when a save was rejected so it can be fixed.
  let editor = $state('');
  $effect.pre(() => {
    editor = form && 'output' in form && typeof form.output === 'string' ? form.output : pretty(data.tags?.output ?? null);
  });

  const errors = $derived(form && 'errors' in form ? (form.errors as string[]) : []);
</script>

<svelte:head>
  <title>{data.card.name} · Admin · ygo.tools</title>
</svelte:head>

{#snippet tagView(out: TagOutput)}
  {#if !out.effects.length}
    <p class="text-sm opacity-70">No effects.</p>
  {/if}
  <ol class="flex flex-col gap-2">
    {#each out.effects as effect (`${effect.text_source}:${effect.effect_index}`)}
      <li class="rounded-container border-surface-500/30 border p-2 text-sm">
        <div class="flex flex-wrap items-center gap-1">
          <span class="chip preset-tonal-surface text-xs">{effect.text_source === 'pendulum' ? 'P' : '#'}{effect.effect_index}</span>
          <span class="chip preset-tonal-primary text-xs">{effect.effect_type}</span>
          {#if effect.opt !== 'none'}<span class="chip preset-tonal-surface text-xs">OPT: {effect.opt}</span>{/if}
          {#if effect.phase_restriction.length}<span class="chip preset-tonal-surface text-xs">{effect.phase_restriction.join('/')} phase</span>{/if}
          {#if effect.turn_restriction !== 'any'}<span class="chip preset-tonal-surface text-xs">{effect.turn_restriction} turn</span>{/if}
        </div>
        <blockquote class="border-surface-500/40 my-1 border-l-2 pl-2 text-xs whitespace-pre-wrap opacity-80">{effect.snippet}</blockquote>
        {#each effect.triggers as trigger, i (i)}
          <p class="font-mono text-xs"><span class="opacity-60">when </span>{describeTrigger(trigger)}</p>
        {/each}
        {#each effect.actions as action, i (i)}
          <p class="font-mono text-xs"><span class="opacity-60">{i + 1}. </span>{describeAction(action)}</p>
        {/each}
      </li>
    {/each}
  </ol>
  {#if out.unmapped.length}
    <div class="mt-2 text-xs">
      <span class="font-semibold">Proposed terms:</span>
      {#each out.unmapped as u (`${u.kind}:${u.proposed_term}`)}
        <span class="chip preset-tonal-warning ml-1">{u.kind}: {u.proposed_term}</span>
      {/each}
    </div>
  {/if}
{/snippet}

<section class="card flex flex-col gap-2 p-3">
  <div class="flex flex-wrap items-center gap-2">
    <h1 class="h4">{data.card.name}</h1>
    <span class="text-xs opacity-60">#{data.card.id}</span>
    {#if !data.tags}<span class="chip preset-tonal-surface text-xs">untagged</span>{/if}
    {#if data.tags?.locked}<span class="chip preset-tonal-primary text-xs">locked ({data.tags.source})</span>{/if}
    {#if data.tags?.pending_draft}<span class="chip preset-tonal-warning text-xs">errata draft to review</span>{/if}
    {#if data.tags && data.stale && !data.tags.pending_draft}<span class="chip preset-tonal-warning text-xs">text changed since tagging</span>{/if}
  </div>
  <p class="text-sm opacity-80">{data.card.typeLine}</p>
  {#if data.tags}
    <p class="text-xs opacity-60">
      {data.tags.model || 'hand-edited'}{data.tags.prompt_version ? ` · prompt ${data.tags.prompt_version}` : ''} · {new Date(
        data.tags.tagged_at,
      ).toLocaleString()}
    </p>
  {/if}
  <p class="text-sm whitespace-pre-wrap">{data.card.effectText || '(no text)'}</p>
  {#if data.card.pendulumText}
    <p class="text-sm whitespace-pre-wrap"><span class="font-semibold">Pendulum: </span>{data.card.pendulumText}</p>
  {/if}
  {#if data.archetypes.length}
    <p class="flex flex-wrap gap-1 text-xs">
      {#each data.archetypes as a (`${a.archetype}:${a.source}`)}
        <span class="chip preset-tonal-surface" title={a.source}>{a.archetype}</span>
      {/each}
    </p>
  {/if}
  {#if data.unresolvedNames.length}
    <p class="text-warning-500 text-sm">Quoted names that match no card: {data.unresolvedNames.join(', ')}</p>
  {/if}
</section>

{#if errors.length}
  <section class="card preset-tonal-error p-3 text-sm">
    <ul class="list-inside list-disc">
      {#each errors as e (e)}<li>{e}</li>{/each}
    </ul>
  </section>
{:else if form && Object.keys(form).length}
  <section class="card preset-tonal-success p-2 text-sm">Saved.</section>
{/if}

<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
  <section class="card flex flex-col gap-2 p-3">
    <h2 class="h5">Current tags</h2>
    {#if data.tags?.output}
      {@render tagView(data.tags.output)}
    {:else}
      <p class="text-sm opacity-70">Not tagged yet.</p>
    {/if}
  </section>

  <section class="card flex flex-col gap-2 p-3">
    <h2 class="h5">Correct</h2>
    <form method="POST" action="?/save" use:enhance class="flex flex-col gap-2">
      <textarea class="textarea font-mono text-xs" name="output" rows="24" spellcheck="false" bind:value={editor}></textarea>
      <div class="flex flex-wrap gap-2">
        <button class="btn preset-filled-primary-500 btn-sm" type="submit">Save correction (locks card)</button>
        <button class="btn preset-tonal-surface btn-sm" type="button" onclick={() => (editor = pretty(data.tags?.output ?? null))}>Reset</button>
      </div>
    </form>
    {#if data.tags?.locked}
      <form method="POST" action="?/unlock" use:enhance>
        <button class="btn preset-tonal-surface btn-sm" type="submit">Unlock (allow automatic re-tagging)</button>
      </form>
    {/if}
  </section>
</div>

{#if data.tags?.pending_draft}
  <section class="card flex flex-col gap-2 p-3">
    <h2 class="h5">Errata draft</h2>
    <p class="text-sm opacity-80">The card text changed after it was hand-corrected. The tagger's version for the new text:</p>
    {@render tagView(data.tags.pending_draft)}
    <div class="flex flex-wrap gap-2">
      <form method="POST" action="?/acceptDraft" use:enhance>
        <button class="btn preset-filled-primary-500 btn-sm" type="submit">Accept draft</button>
      </form>
      <form method="POST" action="?/discardDraft" use:enhance>
        <button class="btn preset-tonal-surface btn-sm" type="submit">Keep current tags for the new text</button>
      </form>
    </div>
  </section>
{/if}

<section class="card flex flex-col gap-2 p-3">
  <h2 class="h5">Gold set</h2>
  {#if data.gold}
    <p class="text-sm">
      In the gold set{data.gold.notes ? `: ${data.gold.notes}` : ''}.
      {#if data.goldScore}
        Current tags score <span class="font-semibold">{(data.goldScore.score * 100).toFixed(0)}%</span> against it (structural comparison).
      {/if}
    </p>
    {#if data.goldScore?.notes.length}
      <ul class="list-inside list-disc font-mono text-xs">
        {#each data.goldScore.notes as n (n)}<li>{n}</li>{/each}
      </ul>
    {/if}
  {/if}
  {#if data.tags?.output}
    <form method="POST" action="?/addGold" use:enhance class="flex flex-wrap gap-2">
      <input class="input max-w-md text-sm" name="notes" placeholder="Notes (optional)" value={data.gold?.notes ?? ''} />
      <button class="btn preset-tonal-primary btn-sm" type="submit"
        >{data.gold ? 'Replace gold entry with current tags' : 'Add current tags to gold set'}</button>
    </form>
  {/if}
</section>
