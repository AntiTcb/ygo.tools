<script lang="ts">
  import { formatDateRange, formatTime } from '$lib/event-map/dates';
  import { describeEventTime, eventTimeHint } from '$lib/event-map/event-time';
  import { distanceKm, formatDistance, formatDuration } from '$lib/event-map/geo';
  import type { Route as DrivingRoute } from '$lib/event-map/mapbox';
  import { EVENT_TYPE_LABELS, type EventItem, type EventType, type LngLat } from '$lib/event-map/types';
  import ClockIcon from '~icons/lucide/clock';
  import ExternalLinkIcon from '~icons/lucide/external-link';
  import LoaderIcon from '~icons/lucide/loader-circle';
  import MailIcon from '~icons/lucide/mail';
  import MapPinIcon from '~icons/lucide/map-pin';
  import NavigationIcon from '~icons/lucide/navigation';
  import RouteIcon from '~icons/lucide/route';
  import SwordsIcon from '~icons/lucide/swords';
  import UsersIcon from '~icons/lucide/users';
  import XIcon from '~icons/lucide/x';
  import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';
  import AddToCalendar from './AddToCalendar.svelte';

  interface Props {
    event: EventItem;
    origin: LngLat | null;
    unit: 'mi' | 'km';
    route: DrivingRoute | null;
    routeLoading: boolean;
    routeError: string | null;
    ondirections: () => void;
    onclearroute: () => void;
    onclose: () => void;
  }

  let { event, origin, unit, route, routeLoading, routeError, ondirections, onclearroute, onclose }: Props = $props();

  const TYPE_STYLE: Record<EventType, { border: string; chip: string }> = {
    regional: { border: 'border-l-primary-500', chip: 'preset-filled-primary-500' },
    ots: { border: 'border-l-warning-500', chip: 'preset-filled-warning-500' },
    ycs: { border: 'border-l-tertiary-500', chip: 'preset-filled-tertiary-500' },
  };
  const FORMAT_CHIP: Record<string, string> = {
    Advanced: 'preset-filled-error-400-600',
    Genesys: 'preset-filled-success-500',
  };

  const venue = $derived(event.venue);
  const timeInfo = $derived(describeEventTime(event));
  const located = $derived(venue?.lat != null && venue.lng != null);
  const straightLine = $derived(origin && venue?.lat != null && venue.lng != null ? distanceKm(origin, { lat: venue.lat, lng: venue.lng }) : null);
</script>

{#snippet term(Icon: typeof ClockIcon, label: string)}
  <dt class="flex items-center gap-1.5 opacity-60"><Icon class="size-3.5" />{label}</dt>
{/snippet}

<article
  class="card space-y-3! border-l-4 {event.isRemote ? 'border-l-secondary-400' : TYPE_STYLE[event.type].border}"
  data-testid="event-map-details"
  data-event-id={event.id}>
  <div class="flex items-start justify-between gap-2">
    <div>
      <div class="mb-1 flex flex-wrap gap-1">
        <span class="chip {TYPE_STYLE[event.type].chip} text-xs">{EVENT_TYPE_LABELS[event.type]}</span>
        {#each event.formats as format (format)}
          <span class="chip {FORMAT_CHIP[format] ?? 'preset-filled-surface-500'} text-xs">{format}</span>
        {/each}
        {#if event.isRemote}<span class="chip preset-filled-secondary-500 text-xs">Remote</span>{/if}
      </div>
      <h2 class="h5">{event.host}</h2>
    </div>
    <button
      type="button"
      class="btn-icon btn-icon-sm hover:preset-tonal-error"
      aria-label="Remove from selection"
      title="Remove from selection"
      onclick={onclose}>
      <XIcon class="size-4" />
    </button>
  </div>

  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
    {@render term(ClockIcon, 'When')}
    <dd>
      {formatDateRange(event.date, event.endDate)}
      {#if event.startTime}
        ·
        <Tooltip positioning={{ placement: 'top' }}>
          <Tooltip.Trigger class="cursor-help underline decoration-dotted underline-offset-2">
            {timeInfo?.venue ?? formatTime(event.startTime) + (event.tzNote ? ` ${event.tzNote}` : '')}
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner class="z-50">
              <Tooltip.Content class="card preset-filled-surface-950-50 max-w-xs p-2 text-xs">{eventTimeHint(event)}</Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip>
        {#if timeInfo && !timeInfo.same}
          <div class="text-primary-400 text-xs">{timeInfo.viewer} your time</div>
        {:else if !timeInfo}
          <div class="text-xs opacity-60">Time zone not listed</div>
        {/if}
      {/if}
    </dd>

    {#if event.isRemote}
      {@render term(MapPinIcon, 'Where')}
      <dd>
        Online
        {#if event.remoteUrl}
          · <a class="anchor" href={event.remoteUrl} target="_blank" rel="noopener nofollow">Join link</a>
        {/if}
      </dd>
    {:else if venue}
      {@render term(MapPinIcon, 'Where')}
      <dd>
        {#if venue.name && venue.name !== event.host}<div class="font-medium">{venue.name}</div>{/if}
        <div>{venue.address}</div>
        <div class="opacity-70">{event.country}</div>
      </dd>
    {/if}

    {#if event.capacity}
      {@render term(UsersIcon, 'Capacity')}
      <dd>{event.capacity}</dd>
    {/if}

    {#if event.email || event.phone}
      {@render term(MailIcon, 'Contact')}
      <dd class="break-all">
        {#if event.email}<a class="anchor" href="mailto:{event.email}">{event.email}</a>{/if}
        {#if event.phone}<div>{event.phone}</div>{/if}
      </dd>
    {/if}

    {#if event.dragonDuel !== null}
      {@render term(SwordsIcon, 'Dragon Duel')}
      <dd>{event.dragonDuel ? 'Yes' : 'No'}</dd>
    {/if}

    {#if straightLine !== null && !route}
      {@render term(NavigationIcon, 'Distance')}
      <dd>{formatDistance(straightLine, unit)} (straight line)</dd>
    {/if}

    {#if route}
      {@render term(RouteIcon, 'Drive')}
      <dd>
        <span class="text-success-400 font-semibold">{formatDuration(route.duration)}</span>
        · {formatDistance(route.distance / 1000, unit)}
      </dd>
    {/if}
  </dl>

  {#if routeError}
    <div role="alert" class="card preset-tonal-error p-2 text-sm">{routeError}</div>
  {/if}
  {#if !event.isRemote && !located}
    <p class="text-warning-400 text-xs">This venue hasn't been located on the map yet.</p>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    {#if !event.isRemote && located}
      {#if route}
        <button type="button" class="btn btn-sm preset-outlined-success-500" onclick={onclearroute}>
          <XIcon class="size-4" />
          Clear route
        </button>
      {:else}
        <button
          type="button"
          class="btn btn-sm preset-filled-success-500"
          onclick={ondirections}
          disabled={!origin || routeLoading}
          title={origin ? undefined : 'Set a starting point first'}>
          {#if routeLoading}<LoaderIcon class="size-4 animate-spin" />{:else}<NavigationIcon class="size-4" />{/if}
          Directions
        </button>
      {/if}
    {/if}
    <AddToCalendar {event} />
    <a class="anchor ml-auto flex items-center gap-1 text-xs opacity-70" href={event.sourceUrl} target="_blank" rel="noopener"
      >Official listing <ExternalLinkIcon class="size-3" /></a>
  </div>
</article>
