<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import EventCalendar from '$components/event-map/EventCalendar.svelte';
  import EventDetails from '$components/event-map/EventDetails.svelte';
  import EventMap from '$components/event-map/EventMap.svelte';
  import FilterBar from '$components/event-map/FilterBar.svelte';
  import LocationControl from '$components/event-map/LocationControl.svelte';
  import SubscribeDialog from '$components/event-map/SubscribeDialog.svelte';
  import '$components/event-map/event-map.css';
  import { buildIcs } from '$lib/event-map/calendar-links';
  import { overlapsRange, today, weekendOf } from '$lib/event-map/dates';
  import { applyFilters, filtersToParams, parseFilters, type Filters } from '$lib/event-map/filters';
  import { areaOf, MAP_AREAS } from '$lib/event-map/map-areas';
  import { drivingRoute, type Place, type Route } from '$lib/event-map/mapbox';
  import { parseRegion, regionParams, REGIONS, type CalendarRange, type EventItem, type EventType } from '$lib/event-map/types';
  import { SegmentedControl } from '@skeletonlabs/skeleton-svelte';
  import Seo from 'sk-seo';
  import { fly } from 'svelte/transition';
  import ArrowDownIcon from '~icons/lucide/arrow-down';
  import CalendarDaysIcon from '~icons/lucide/calendar-days';
  import CircleAlertIcon from '~icons/lucide/circle-alert';
  import HistoryIcon from '~icons/lucide/clock-arrow-left';
  import DownloadIcon from '~icons/lucide/download';
  import InfoIcon from '~icons/lucide/info';
  import ListChecksIcon from '~icons/lucide/list-checks';
  import ListXIcon from '~icons/lucide/list-x';
  import RefreshIcon from '~icons/lucide/refresh-cw';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const unit = $derived(REGIONS[data.region].distanceUnit);
  const filters = $derived(parseFilters(page.url.searchParams));

  let origin = $state<Place | null>(null);

  // Restore the saved starting point for this region (kept on-device only).
  $effect(() => {
    const key = `origin:${data.region}`;
    try {
      const saved = localStorage.getItem(key);
      origin = saved ? (JSON.parse(saved) as Place) : null;
    } catch {
      origin = null;
    }
  });

  const setOrigin = (place: Place | null) => {
    origin = place;
    clearRoute();
    try {
      const key = `origin:${data.region}`;
      if (place) localStorage.setItem(key, JSON.stringify(place));
      else localStorage.removeItem(key);
    } catch {
      // Storage unavailable; the origin still applies for this visit.
    }
    if (!place && filters.radius) setFilters({ ...filters, radius: null });
  };

  /** Writes filters to the URL, keeping the region param. */
  const setFilters = (next: Filters) => {
    const params = regionParams(data.region);
    for (const [key, value] of filtersToParams(next)) params.set(key, value);
    const qs = params.toString();
    goto(qs ? `?${qs}` : page.url.pathname, { replaceState: true, noScroll: true, keepFocus: true });
  };

  /** Switches region. Filters are dropped: states, weekends and formats differ per region. */
  const setRegion = (region: string | null) => {
    const next = parseRegion(region);
    if (next === data.region) return;
    const qs = regionParams(next).toString();
    goto(qs ? `?${qs}` : page.url.pathname, { noScroll: true });
  };

  const ctx = $derived({ origin, unit, today: today() });
  const visible = $derived(applyFilters(data.events, filters, ctx));

  // Weekend choices reflect every other active filter.
  const weekends = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const e of applyFilters(data.events, { ...filters, weekend: null }, ctx)) {
      const key = weekendOf(e.date);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    if (filters.weekend) counts[filters.weekend] ??= 0;
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, count }));
  });

  const types = $derived([...new Set(data.events.map((e) => e.type))].sort() as EventType[]);
  const formats = $derived([...new Set(data.events.flatMap((e) => e.formats))].sort());
  const states = $derived([...new Set(data.events.map((e) => e.state).filter((s): s is string => !!s))].sort());

  // Selection: a set of event ids, kept across filter changes so a trip can
  // span several weekends. Selected events stay on the calendar and map even
  // when the filters would hide them.
  let selectedIds = $state<string[]>([]);
  const selectedEvents = $derived(
    selectedIds
      .map((id) => data.events.find((e) => e.id === id))
      .filter((e): e is EventItem => !!e)
      .sort((a, b) => a.date.localeCompare(b.date) || a.host.localeCompare(b.host)),
  );
  const shown = $derived.by(() => {
    const ids = new Set(visible.map((e) => e.id));
    return [...visible, ...selectedEvents.filter((e) => !ids.has(e.id))];
  });

  // The count chip and the map follow the range the calendar is showing (a
  // month, or a week in Week view). Until the calendar reports it, show everything.
  let range = $state<CalendarRange | null>(null);
  const rangeEvents = $derived(range ? shown.filter((e) => overlapsRange(e, range!.start, range!.end)) : shown);
  const rangeRemote = $derived(rangeEvents.filter((e) => e.isRemote).length);
  // Selected events stay pinned even outside the range so a multi-weekend plan
  // (and any route to it) doesn't vanish while paging the calendar.
  const mapEvents = $derived.by(() => {
    const ids = new Set(rangeEvents.map((e) => e.id));
    return [...rangeEvents, ...selectedEvents.filter((e) => !ids.has(e.id))];
  });

  // Regions with far-flung states get small inset maps instead of zooming out.
  const areas = $derived(MAP_AREAS[data.region]);
  const byArea = $derived.by(() => {
    const groups: Record<string, EventItem[]> = {};
    for (const e of mapEvents) (groups[areaOf(e, data.region)] ??= []).push(e);
    return groups;
  });
  const hasPin = (e: EventItem) => !e.isRemote && e.venue?.lat != null;
  const activeInsets = $derived(areas.insets.filter((a) => byArea[a.id]?.some(hasPin)));
  const fitToEvents = $derived(!!(filters.weekend || filters.state || (filters.radius && origin) || range?.kind === 'week'));

  const toggleSelected = (id: string) => {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((x) => x !== id);
      if (routeFor === id) clearRoute();
    } else {
      selectedIds = [...selectedIds, id];
    }
  };

  // On a single-column (mobile) layout the details sit below the calendar and
  // map, so a floating button points to them until they scroll into view.
  let detailsEl = $state<HTMLElement | null>(null);
  let detailsBelow = $state(false);
  $effect(() => {
    if (!detailsEl) {
      detailsBelow = false;
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      detailsBelow = !!entry && !entry.isIntersecting && entry.boundingClientRect.top > 0;
    });
    observer.observe(detailsEl);
    return () => observer.disconnect();
  });

  const jumpToDetails = () => detailsEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const clearSelection = () => {
    selectedIds = [];
    clearRoute();
  };

  const exportSelection = () => {
    const ics = buildIcs(selectedEvents, { name: 'Yu-Gi-Oh! event plan' });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'ygo-events.ics' });
    a.click();
    URL.revokeObjectURL(url);
  };

  // Directions are shown for one selected event at a time.
  let routeFor = $state<string | null>(null);
  let route = $state<Route | null>(null);
  let routeLoading = $state(false);
  let routeError = $state<string | null>(null);
  const routeArea = $derived.by(() => {
    const e = routeFor ? data.events.find((x) => x.id === routeFor) : null;
    return e ? areaOf(e, data.region) : null;
  });

  const clearRoute = () => {
    routeFor = null;
    route = null;
    routeError = null;
  };

  const getDirections = async (event: EventItem) => {
    const venue = event.venue;
    if (!origin || venue?.lat == null || venue.lng == null) return;
    clearRoute();
    routeFor = event.id;
    routeLoading = true;
    try {
      route = await drivingRoute(origin, { lat: venue.lat, lng: venue.lng }, data.mapboxToken);
      if (!route) routeError = 'No driving route found.';
    } catch (err) {
      routeError = (err as Error).message;
    } finally {
      routeLoading = false;
    }
  };

  const LEGEND = [
    { label: 'Regional', color: '--ev-regional' },
    { label: 'OTS Championship', color: '--ev-ots' },
    { label: 'YCS', color: '--ev-ycs' },
    { label: 'Remote', color: '--ev-remote' },
    { label: 'Advanced', color: '--ev-advanced' },
    { label: 'Genesys', color: '--ev-genesys' },
  ];

  // The server renders UTC; switch to the viewer's locale and timezone once mounted.
  const updated = $derived(data.updatedAt ? new Date(`${data.updatedAt.replace(' ', 'T')}Z`) : null);
  let updatedLabel = $state<string | null>(null);
  $effect(() => {
    updatedLabel = updated?.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) ?? null;
  });
</script>

<Seo
  title="Event Map – {REGIONS[data.region].label}"
  description="Find Yu-Gi-Oh! Regionals, OTS Championships and YCS events weekend by weekend: calendar, map, driving directions and calendar export."
  keywords="yugioh, ygo, regional, ots championship, ycs, events, tournaments, map, calendar"
  author="AntiTcb" />

<div class="event-map mx-auto flex w-full flex-col gap-3">
  <div class="card space-y-3! p-3 sm:p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="h3">Event Map</h1>
      <SegmentedControl value={data.region} onValueChange={(e) => setRegion(e.value)} aria-label="Region">
        <SegmentedControl.Control>
          <SegmentedControl.Indicator />
          {#each Object.entries(REGIONS) as [key, r] (key)}
            <SegmentedControl.Item value={key} data-testid="event-map-region-{key}">
              <SegmentedControl.ItemText>{r.label}</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
          {/each}
        </SegmentedControl.Control>
      </SegmentedControl>
    </div>

    <FilterBar {filters} {types} {formats} {states} {weekends} {unit} hasOrigin={!!origin} onchange={setFilters}>
      {#snippet location()}
        <LocationControl token={data.mapboxToken} region={data.region} {origin} onchange={setOrigin} />
      {/snippet}
    </FilterBar>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span class="chip preset-filled-primary-500 gap-1.5 font-semibold" data-testid="event-map-count">
        <CalendarDaysIcon class="size-4" />
        {#if range}
          {rangeEvents.length}
          {rangeEvents.length === 1 ? 'event' : 'events'} in {range.title}
          {#if rangeRemote}<span class="font-normal opacity-80">· {rangeRemote} remote</span>{/if}
        {:else}
          Loading…
        {/if}
      </span>
      <ul class="flex flex-wrap items-center gap-3 text-xs" aria-label="Legend">
        {#each LEGEND as item (item.label)}
          <li class="flex items-center gap-1.5">
            <span class="ring-surface-900 inline-block size-3 rounded-full ring-2" style="background: var({item.color})"></span>
            {item.label}
          </li>
        {/each}
      </ul>
      <div class="flex-1"></div>
      <SubscribeDialog region={data.region} {filters} {origin} />
    </div>
  </div>

  {#if data.events.length === 0}
    <div role="alert" class="card preset-tonal-warning flex items-center gap-2 p-3">
      <CircleAlertIcon class="size-5" />
      No events loaded yet. The scraper runs every 6 hours.
    </div>
  {:else if visible.length === 0}
    <div role="alert" class="card preset-tonal-primary flex flex-wrap items-center gap-2 p-3">
      <InfoIcon class="size-5" />
      <span>No events match these filters.</span>
      {#if !filters.past && !filters.weekend}
        <button type="button" class="btn btn-sm preset-filled-primary-500" onclick={() => setFilters({ ...filters, past: true })}>
          <HistoryIcon class="size-4" />
          Show past events
        </button>
      {/if}
    </div>
  {/if}

  <div class="grid gap-3 lg:grid-cols-2">
    <section class="card p-3">
      <EventCalendar events={shown} {selectedIds} focusDate={filters.weekend} onselect={toggleSelected} onrangechange={(r) => (range = r)} />
    </section>

    <section class="flex flex-col gap-3">
      <div class="card relative h-[60vh] min-h-96 overflow-hidden p-0">
        {#if data.mapboxToken}
          {#key data.region}
            <EventMap
              token={data.mapboxToken}
              area={areas.main}
              events={byArea.main ?? []}
              {selectedIds}
              {origin}
              route={routeArea === 'main' ? (route?.geometry ?? null) : null}
              {fitToEvents}
              reserveBottom={activeInsets.length ? 136 : 0}
              onselect={toggleSelected} />
          {/key}
          {#if activeInsets.length}
            <div class="pointer-events-none absolute bottom-8 left-2 flex flex-wrap-reverse items-end gap-2">
              {#each activeInsets as inset (inset.id)}
                <div
                  class="rounded-container border-warning-500 bg-surface-900 pointer-events-auto relative h-24 w-32 overflow-hidden border-2 shadow-lg sm:w-36">
                  <EventMap
                    token={data.mapboxToken}
                    area={inset}
                    events={byArea[inset.id] ?? []}
                    {selectedIds}
                    {origin}
                    route={routeArea === inset.id ? (route?.geometry ?? null) : null}
                    fitToEvents={true}
                    compact
                    onselect={toggleSelected} />
                  <span class="chip preset-filled-warning-500 absolute top-1 left-1 px-1.5 py-0 text-[0.6rem] font-semibold shadow"
                    >{inset.label}</span>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="m-auto p-6 text-center text-sm opacity-70">Set <code class="code">PUBLIC_MAPBOX_TOKEN</code> to show the map.</div>
        {/if}
      </div>

      {#if selectedEvents.length}
        <div bind:this={detailsEl} class="card preset-tonal-primary flex scroll-mt-4 flex-wrap items-center gap-2 space-y-0! p-3">
          <span class="text-primary-300 flex items-center gap-1.5 font-semibold">
            <ListChecksIcon class="size-4" />{selectedEvents.length} selected
          </span>
          <span class="text-xs opacity-70">Click events again to deselect.</span>
          <div class="flex-1"></div>
          <button type="button" class="btn btn-sm preset-filled-success-500" onclick={exportSelection} data-testid="event-map-export">
            <DownloadIcon class="size-4" />
            Export {selectedEvents.length === 1 ? 'event' : `${selectedEvents.length} events`} (.ics)
          </button>
          <button type="button" class="btn btn-sm hover:preset-tonal-error text-error-400" onclick={clearSelection}>
            <ListXIcon class="size-4" />
            Clear selection
          </button>
        </div>
        {#each selectedEvents as event (event.id)}
          <EventDetails
            {event}
            {origin}
            {unit}
            route={routeFor === event.id ? route : null}
            routeLoading={routeFor === event.id && routeLoading}
            routeError={routeFor === event.id ? routeError : null}
            ondirections={() => getDirections(event)}
            onclearroute={clearRoute}
            onclose={() => toggleSelected(event.id)} />
        {/each}
      {:else}
        <p class="text-center text-sm opacity-60">
          Select events on the calendar or map for details, directions and calendar export. Pick as many as you like.
        </p>
      {/if}
    </section>
  </div>

  {#if selectedEvents.length && detailsBelow}
    <button
      type="button"
      class="btn preset-filled-primary-500 fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-xl lg:hidden"
      onclick={jumpToDetails}
      transition:fly={{ y: 24, duration: 150 }}
      data-testid="event-map-jump-details">
      <ListChecksIcon class="size-4" />
      View {selectedEvents.length === 1 ? 'event details' : `${selectedEvents.length} selected events`}
      <ArrowDownIcon class="size-4" />
    </button>
  {/if}

  <p class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2 text-center text-xs opacity-60">
    {#if updated}
      <span class="flex items-center gap-1.5">
        <RefreshIcon class="text-success-400 size-3.5" />
        Events updated <time datetime={updated.toISOString()}>{updatedLabel ?? updated.toUTCString()}</time>
      </span>
    {/if}
    <span>
      Event data from <a class="anchor" href="https://www.yugioh-card.com/en/events/" target="_blank" rel="noopener">yugioh-card.com</a>. Always
      confirm details with the host store.
    </span>
    <span>
      Venue locations from the <a class="anchor" href="https://geocoding.geo.census.gov/" target="_blank" rel="noopener">US Census Bureau</a>,
      <a class="anchor" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> (ODbL) and Mapbox.
    </span>
  </p>
</div>

<svelte:window onkeydown={(e) => e.key === 'Escape' && selectedIds.length && clearSelection()} />
