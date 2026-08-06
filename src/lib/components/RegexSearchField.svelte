<script lang="ts">
  import { COMMON_REGEX_FLAGS, compileRegex, normalizeRegexFlags, toggleRegexFlag } from '$lib/db/regexSearch';

  type Props = {
    label: string;
    pattern: string;
    useRegex: boolean;
    flags: string;
    placeholder?: string;
    testIdPrefix: string;
    rows?: number;
  };

  let {
    label,
    pattern = $bindable(''),
    useRegex = $bindable(false),
    flags = $bindable(''),
    placeholder = '',
    testIdPrefix,
    rows = 3,
  }: Props = $props();

  const compiled = $derived(useRegex && pattern.length > 0 ? compileRegex(pattern, flags) : null);
  const activeFlags = $derived(normalizeRegexFlags(flags));
  const delimiterActive = $derived(compiled?.usedDelimiter ?? false);
</script>

<div class="flex flex-col gap-1.5">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <span class="label-text text-xs font-medium">{label}</span>
    <div class="bg-surface-500/10 inline-flex rounded p-0.5 text-xs" role="group" aria-label="{label} search mode">
      <button
        type="button"
        class="rounded px-2 py-1 transition-colors"
        class:bg-surface-500={!useRegex}
        class:text-surface-50={!useRegex}
        class:opacity-70={useRegex}
        data-testid="{testIdPrefix}-mode-text"
        onclick={() => (useRegex = false)}>
        Contains
      </button>
      <button
        type="button"
        class="rounded px-2 py-1 font-mono transition-colors"
        class:bg-surface-500={useRegex}
        class:text-surface-50={useRegex}
        class:opacity-70={!useRegex}
        data-testid="{testIdPrefix}-regex"
        onclick={() => (useRegex = true)}>
        /regex/
      </button>
    </div>
  </div>

  {#if useRegex}
    <div
      class="border-surface-500/40 bg-surface-50-950 focus-within:border-primary-500 flex overflow-hidden rounded border font-mono text-sm"
      class:border-error-500={compiled?.ok === false}>
      <span class="text-surface-500-400 flex items-start px-2 pt-2 opacity-60 select-none" aria-hidden="true">/</span>
      <textarea
        class="min-h-18 w-full grow resize-y border-0 bg-transparent py-2 pr-1 font-mono text-sm outline-none"
        data-testid={testIdPrefix}
        bind:value={pattern}
        {placeholder}
        {rows}
        spellcheck="false"
        aria-invalid={compiled?.ok === false}
        aria-describedby="{testIdPrefix}-hint"></textarea>
      <span class="text-surface-500-400 flex items-start px-1 pt-2 opacity-60 select-none" aria-hidden="true">/</span>
      <span
        class="text-primary-600-400 flex min-w-6 items-start px-1.5 pt-2 text-xs select-none"
        title={delimiterActive ? 'Flags come from the /pattern/flags form' : 'Active flags'}
        aria-hidden="true">{delimiterActive ? '…' : activeFlags || ''}</span>
    </div>

    <div class="flex flex-wrap items-center gap-1.5" class:opacity-40={delimiterActive}>
      <span class="text-xs opacity-70">Flags</span>
      {#each COMMON_REGEX_FLAGS as f (f.id)}
        <button
          type="button"
          class="btn btn-sm min-w-8 px-2 font-mono"
          class:preset-filled-primary-500={activeFlags.includes(f.id) && !delimiterActive}
          class:preset-tonal-surface={!activeFlags.includes(f.id) || delimiterActive}
          data-testid="{testIdPrefix}-flag-{f.id}"
          title={f.title}
          disabled={delimiterActive}
          aria-pressed={activeFlags.includes(f.id)}
          onclick={() => (flags = toggleRegexFlag(flags, f.id))}>
          {f.label}
        </button>
      {/each}
      <input type="hidden" data-testid="{testIdPrefix}-regex-flags" value={flags} />
    </div>

    <p id="{testIdPrefix}-hint" class="text-xs opacity-70">
      {#if delimiterActive}
        Delimiter form detected — flags after the closing <code class="rounded px-0.5">/</code> override the chips.
      {:else}
        Tip: write a pattern, or use <code class="rounded px-0.5">/pattern/im</code> to embed flags.
      {/if}
    </p>

    {#if compiled?.ok === false}
      <p class="text-error-500 text-xs" data-testid="{testIdPrefix}-error" role="alert">Invalid regex: {compiled.error}</p>
    {:else if compiled?.ok}
      <p class="text-xs opacity-60" data-testid="{testIdPrefix}-ok">
        Matching with <code class="rounded px-0.5">/{compiled.source}/{compiled.flags}</code>
      </p>
    {/if}
  {:else}
    <textarea class="textarea min-h-18 w-full resize-y text-sm" data-testid={testIdPrefix} bind:value={pattern} {placeholder} {rows}></textarea>
    <p class="text-xs opacity-60">Plain substring match (case-sensitive).</p>
  {/if}
</div>
