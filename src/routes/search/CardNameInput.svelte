<script lang="ts">
  import { applySuggestion, type NameSuggestions } from '#lib/effect-search/nameSuggest.js';

  /**
   * A text input that completes card names. In the search box (`whole` false) it completes the name at the
   * end of the request and inserts it quoted; in a card-name field (`whole`) the input is the name.
   */
  let {
    value = $bindable(''),
    whole = false,
    name,
    id,
    placeholder,
    ariaLabel,
    maxlength,
    class: className = '',
  }: {
    value?: string;
    whole?: boolean;
    name?: string;
    id: string;
    placeholder?: string;
    ariaLabel?: string;
    maxlength?: number;
    class?: string;
  } = $props();

  let suggestions = $state<NameSuggestions>({ start: 0, names: [] });
  let active = $state(-1);
  let open = $state(false);
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;

  const fetchSuggestions = (text: string) => {
    clearTimeout(timer);
    controller?.abort();
    if (text.trim().length < 2) {
      suggestions = { start: text.length, names: [] };
      return;
    }
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const res = await fetch(`/search/names?q=${encodeURIComponent(text)}${whole ? '&whole=1' : ''}`, { signal: controller.signal });
        if (!res.ok) return;
        suggestions = (await res.json()) as NameSuggestions;
        active = -1;
        open = true;
      } catch {
        // Aborted by newer typing, or offline: no suggestions.
      }
    }, 120);
  };

  const pick = (cardName: string) => {
    value = whole ? cardName : applySuggestion(value, suggestions.start, cardName);
    suggestions = { start: value.length, names: [] };
    open = false;
    input.focus();
  };

  const onkeydown = (e: KeyboardEvent) => {
    const n = suggestions.names.length;
    if (!open || !n) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = e.key === 'ArrowDown' ? (active + 1) % n : active <= 0 ? n - 1 : active - 1;
    } else if ((e.key === 'Enter' || e.key === 'Tab') && active >= 0) {
      e.preventDefault();
      pick(suggestions.names[active]!);
    } else if (e.key === 'Escape') {
      open = false;
    }
  };
</script>

<div class="relative w-full">
  <input
    bind:this={input}
    class="input w-full {className}"
    {id}
    {name}
    {placeholder}
    {maxlength}
    aria-label={ariaLabel}
    autocomplete="off"
    role="combobox"
    aria-expanded={open && suggestions.names.length > 0}
    aria-controls="{id}-names"
    aria-autocomplete="list"
    aria-activedescendant={active >= 0 ? `${id}-name-${active}` : undefined}
    bind:value
    oninput={() => fetchSuggestions(value)}
    {onkeydown}
    onblur={() => setTimeout(() => (open = false), 150)} />
  {#if open && suggestions.names.length}
    <ul
      id="{id}-names"
      class="border-surface-500/40 bg-surface-50-950 absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded border text-sm shadow-lg"
      role="listbox"
      data-testid="card-name-suggestions">
      {#each suggestions.names as cardName, i (cardName)}
        <li id="{id}-name-{i}" role="option" aria-selected={i === active}>
          <button
            type="button"
            tabindex="-1"
            class="hover:bg-surface-500/15 w-full px-3 py-1.5 text-left {i === active ? 'bg-surface-500/20' : ''}"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pick(cardName)}>{cardName}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
