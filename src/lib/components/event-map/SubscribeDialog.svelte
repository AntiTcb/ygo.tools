<script lang="ts">
  import { page } from '$app/state';
  import { filtersToParams, type Filters } from '#lib/event-map/filters.js';
  import { regionParams, type LngLat, type Region } from '#lib/event-map/types.js';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import CalendarSyncIcon from '~icons/lucide/calendar-sync';
  import CheckIcon from '~icons/lucide/check';
  import CopyIcon from '~icons/lucide/copy';
  import ExternalLinkIcon from '~icons/lucide/external-link';
  import RssIcon from '~icons/lucide/rss';
  import XIcon from '~icons/lucide/x';

  interface Props {
    region: Region;
    filters: Filters;
    origin: LngLat | null;
  }

  let { region, filters, origin }: Props = $props();

  let copied = $state(false);

  const feedUrl = $derived.by(() => {
    // Weekend/past filters don't make sense for a rolling feed.
    const params = filtersToParams({ ...filters, weekend: null, past: false });
    for (const [key, value] of regionParams(region)) params.set(key, value);
    if (filters.radius && origin) {
      params.set('lat', origin.lat.toFixed(3));
      params.set('lng', origin.lng.toFixed(3));
    } else {
      params.delete('radius');
    }
    const qs = params.toString();
    return new URL(`/event-map/calendar.ics${qs ? `?${qs}` : ''}`, page.url.origin).toString();
  });
  const webcalUrl = $derived(feedUrl.replace(/^https?:/, 'webcal:'));

  const copy = async () => {
    await navigator.clipboard.writeText(feedUrl);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  };

  const animation =
    'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog>
  <Dialog.Trigger class="btn btn-sm preset-tonal-warning" data-testid="event-map-subscribe">
    <CalendarSyncIcon class="size-4" />
    Subscribe
  </Dialog.Trigger>
  <Portal>
    <Dialog.Backdrop class="bg-surface-950/60 fixed inset-0 z-50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-full max-w-lg space-y-4 p-4 shadow-xl {animation}">
        <header class="flex items-center justify-between gap-2">
          <Dialog.Title class="h4 flex items-center gap-2">
            <RssIcon class="text-warning-400 size-5" />
            Subscribe to these events
          </Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal" aria-label="Close"><XIcon class="size-4" /></Dialog.CloseTrigger>
        </header>
        <Dialog.Description class="text-sm opacity-80">
          Add a calendar that stays in sync with the current filters (type, format, state{filters.radius && origin ? ', distance' : ''}). New events
          show up automatically after each refresh.
        </Dialog.Description>

        <div class="flex">
          <input class="input min-w-0 grow rounded-r-none text-sm" readonly value={feedUrl} aria-label="Calendar feed URL" />
          <button type="button" class="btn btn-sm rounded-l-none {copied ? 'preset-filled-success-500' : 'preset-filled-primary-500'}" onclick={copy}>
            {#if copied}<CheckIcon class="size-4" /> Copied{:else}<CopyIcon class="size-4" /> Copy{/if}
          </button>
        </div>

        <div class="flex flex-wrap gap-2">
          <a
            class="btn btn-sm preset-outlined-primary-500"
            target="_blank"
            rel="noopener"
            href="https://calendar.google.com/calendar/r?cid={encodeURIComponent(webcalUrl)}"><ExternalLinkIcon class="size-4" />Google Calendar</a>
          <a
            class="btn btn-sm preset-outlined-primary-500"
            target="_blank"
            rel="noopener"
            href="https://outlook.live.com/calendar/0/addfromweb?url={encodeURIComponent(feedUrl)}&name={encodeURIComponent('Yu-Gi-Oh! events')}"
            ><ExternalLinkIcon class="size-4" />Outlook</a>
          <a class="btn btn-sm preset-outlined-primary-500" href={webcalUrl}><CalendarSyncIcon class="size-4" />Apple Calendar</a>
        </div>
        {#if filters.radius && origin}
          <p class="text-xs opacity-60">The link includes your approximate starting point (rounded to ~100 m) to apply the distance filter.</p>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
