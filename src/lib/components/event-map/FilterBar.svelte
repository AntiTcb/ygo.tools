<script lang="ts">
  import { formatWeekend } from '$lib/event-map/dates';
  import type { Filters } from '$lib/event-map/filters';
  import { EVENT_TYPE_LABELS, type EventType } from '$lib/event-map/types';
  import { Switch, ToggleGroup } from '@skeletonlabs/skeleton-svelte';
  import type { Snippet } from 'svelte';
  import ChevronLeftIcon from '~icons/lucide/chevron-left';
  import ChevronRightIcon from '~icons/lucide/chevron-right';

  interface Props {
    filters: Filters;
    /** Event types present in this region. */
    types: EventType[];
    formats: string[];
    states: string[];
    /** Weekends (Saturday keys) with event counts, in date order. */
    weekends: { key: string; count: number }[];
    unit: 'mi' | 'km';
    hasOrigin: boolean;
    /** The starting-point control, rendered in the location panel. */
    location: Snippet;
    onchange: (filters: Filters) => void;
  }

  let { filters, types, formats, states, weekends, unit, hasOrigin, location, onchange }: Props = $props();

  const RADII = [25, 50, 100, 200, 500];
  /**
   * Toggle colours per event type / format when pressed (`!` beats the toggle
   * group's neutral pressed style). A pressed toggle means "only show these";
   * with none pressed, nothing is filtered out.
   */
  const TYPE_ON: Record<EventType, string> = {
    regional: 'data-[state=on]:preset-filled-primary-500!',
    ots: 'data-[state=on]:preset-filled-warning-500!',
    ycs: 'data-[state=on]:preset-filled-tertiary-500!',
  };
  const FORMAT_ON: Record<string, string> = {
    Advanced: 'data-[state=on]:preset-filled-error-400-600!',
    Genesys: 'data-[state=on]:preset-filled-success-500!',
  };
  const toggleItem = 'px-3 text-sm';

  const update = (patch: Partial<Filters>) => onchange({ ...filters, ...patch });

  const weekendIndex = $derived(weekends.findIndex((w) => w.key === filters.weekend));

  const stepWeekend = (delta: number) => {
    const next = weekends[weekendIndex + delta] ?? (weekendIndex === -1 ? weekends[0] : undefined);
    if (next) update({ weekend: next.key });
  };

  const panel = 'rounded-container border-surface-700 bg-surface-950/40 border p-3';
</script>

<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
  <section aria-label="Location" class="{panel} md:col-span-2 xl:col-span-1">
    {@render location()}
    <div class="mt-2 grid grid-cols-2 gap-2">
      <label class="label">
        <span class="label-text text-xs font-medium">Distance</span>
        <select
          class="select text-sm"
          value={filters.radius ?? ''}
          disabled={!hasOrigin}
          title={hasOrigin ? undefined : 'Set a starting point to filter by distance'}
          data-testid="event-map-radius"
          onchange={(e) => update({ radius: Number(e.currentTarget.value) || null })}>
          <option value="">Any distance</option>
          {#each RADII as r (r)}
            <option value={r}>Within {r} {unit}</option>
          {/each}
        </select>
      </label>
      <label class="label">
        <span class="label-text text-xs font-medium">State / province</span>
        <select
          class="select text-sm"
          value={filters.state ?? ''}
          data-testid="event-map-state"
          onchange={(e) => update({ state: e.currentTarget.value || null })}>
          <option value="">All</option>
          {#each states as state (state)}
            <option value={state}>{state}</option>
          {/each}
        </select>
      </label>
    </div>
  </section>

  <section aria-label="Dates" class={panel}>
    <div class="label">
      <span class="label-text text-xs font-medium">Weekend</span>
      <div class="flex">
        <button
          type="button"
          class="btn-icon preset-tonal-primary rounded-r-none"
          aria-label="Previous weekend"
          disabled={weekendIndex <= 0}
          onclick={() => stepWeekend(-1)}><ChevronLeftIcon class="size-4" /></button>
        <select
          class="select min-w-0 flex-1 rounded-none text-sm"
          aria-label="Weekend"
          value={filters.weekend ?? ''}
          data-testid="event-map-weekend"
          onchange={(e) => update({ weekend: e.currentTarget.value || null })}>
          <option value="">All dates</option>
          {#each weekends as w (w.key)}
            <option value={w.key}>{formatWeekend(w.key)} ({w.count})</option>
          {/each}
        </select>
        <button
          type="button"
          class="btn-icon preset-tonal-primary rounded-l-none"
          aria-label="Next weekend"
          disabled={weekendIndex >= weekends.length - 1}
          onclick={() => stepWeekend(1)}><ChevronRightIcon class="size-4" /></button>
      </div>
    </div>
    <Switch class="mt-3" checked={filters.past} onCheckedChange={(e) => update({ past: e.checked })}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label class="text-sm">Include past events</Switch.Label>
      <Switch.HiddenInput />
    </Switch>
  </section>

  <section aria-label="Event types" class={panel}>
    {#if types.length > 1}
      <div class="label">
        <span class="label-text text-xs font-medium">Event type</span>
        <ToggleGroup multiple value={filters.types} onValueChange={(e) => update({ types: e.value as EventType[] })} aria-label="Event type">
          {#each types as type (type)}
            <ToggleGroup.Item value={type} class="{toggleItem} {TYPE_ON[type]}" data-testid="event-map-type-{type}"
              >{EVENT_TYPE_LABELS[type]}</ToggleGroup.Item>
          {/each}
        </ToggleGroup>
      </div>
    {/if}
    {#if formats.length > 1}
      <div class="label" class:mt-2={types.length > 1}>
        <span class="label-text text-xs font-medium">Regional format</span>
        <ToggleGroup multiple value={filters.formats} onValueChange={(e) => update({ formats: e.value })} aria-label="Regional format">
          {#each formats as format (format)}
            <ToggleGroup.Item value={format} class="{toggleItem} {FORMAT_ON[format] ?? ''}">{format}</ToggleGroup.Item>
          {/each}
        </ToggleGroup>
      </div>
    {/if}
    {#if types.length <= 1 && formats.length <= 1}
      <p class="text-sm opacity-60">{types.map((t) => EVENT_TYPE_LABELS[t]).join(', ') || 'All events'}</p>
    {/if}
  </section>
</div>
