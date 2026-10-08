<script lang="ts">
  import { searchPlaces, type Place } from '$lib/event-map/mapbox';
  import type { Region } from '$lib/event-map/types';
  import { Combobox, Portal, useListCollection, type ComboboxRootProps } from '@skeletonlabs/skeleton-svelte';
  import LoaderIcon from '~icons/lucide/loader-circle';
  import LocateFixedIcon from '~icons/lucide/locate-fixed';
  import MapPinIcon from '~icons/lucide/map-pin';
  import XIcon from '~icons/lucide/x';

  interface Props {
    token: string;
    region: Region;
    origin: Place | null;
    onchange: (place: Place | null) => void;
  }

  let { token, region, origin, onchange }: Props = $props();

  /** Wait this long after typing stops before searching (each search is a Mapbox request). */
  const SEARCH_DEBOUNCE_MS = 350;
  const MIN_QUERY_LENGTH = 3;

  let query = $state('');
  let places = $state<Place[]>([]);
  let searching = $state(false);
  let locating = $state(false);
  let message = $state<string | null>(null);
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const collection = $derived(useListCollection({ items: places, itemToString: (p) => p.label, itemToValue: (p) => p.label }));

  const search = async (text: string) => {
    controller?.abort();
    controller = new AbortController();
    searching = true;
    message = null;
    try {
      places = await searchPlaces(text, token, region, controller.signal);
      if (!places.length) message = 'No matches found.';
    } catch (err) {
      if ((err as Error).name !== 'AbortError') message = (err as Error).message;
    } finally {
      searching = false;
    }
  };

  const onInputValueChange: ComboboxRootProps['onInputValueChange'] = (e) => {
    query = e.inputValue;
    clearTimeout(timer);
    const text = query.trim();
    if (text.length < MIN_QUERY_LENGTH) {
      controller?.abort();
      places = [];
      return;
    }
    timer = setTimeout(() => search(text), SEARCH_DEBOUNCE_MS);
  };

  const choose = (place: Place) => {
    clearTimeout(timer);
    query = '';
    places = [];
    message = null;
    onchange(place);
  };

  const onValueChange: ComboboxRootProps['onValueChange'] = (e) => {
    const place = places.find((p) => p.label === e.value[0]);
    if (place) choose(place);
  };

  // Typing a city and pressing Enter (or Go on a phone keyboard) without picking
  // a suggestion would otherwise leave no starting point set.
  let highlighted = $state<string | null>(null);
  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || highlighted) return;
    const first = places[0];
    if (!first) return;
    e.preventDefault();
    choose(first);
  };

  /** Text typed but no place picked yet. */
  const pending = $derived(query.trim().length >= MIN_QUERY_LENGTH && places.length > 0);

  const locate = () => {
    if (!('geolocation' in navigator)) {
      message = 'Location is not available in this browser. Search for a city instead.';
      return;
    }
    locating = true;
    message = null;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        locating = false;
        onchange({ label: 'My location', lat: coords.latitude, lng: coords.longitude });
      },
      (err) => {
        locating = false;
        message =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Search for a city instead.'
            : 'Could not get your location. Search for a city instead.';
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };
</script>

<div class="flex flex-col gap-1.5">
  <Combobox
    {collection}
    inputValue={query}
    value={[]}
    {onInputValueChange}
    {onValueChange}
    onHighlightChange={(e) => (highlighted = e.highlightedValue)}
    placeholder="City, ZIP or address"
    inputBehavior="none"
    selectionBehavior="clear"
    openOnClick={false}>
    <Combobox.Label class="text-xs font-medium">Starting point</Combobox.Label>
    <div class="flex">
      <Combobox.Control class="grow">
        <Combobox.Input class="rounded-r-none text-sm" data-testid="event-map-location-search" {onkeydown} />
        {#if searching}<LoaderIcon class="size-4 shrink-0 animate-spin opacity-60" />{/if}
      </Combobox.Control>
      <button
        type="button"
        class="btn-icon preset-filled-primary-500 h-auto! w-[2.125rem]! self-stretch rounded-l-none"
        title="Use my location"
        aria-label="Use my location"
        onclick={locate}
        disabled={locating}>
        {#if locating}<LoaderIcon class="size-4 animate-spin" />{:else}<LocateFixedIcon class="size-4" />{/if}
      </button>
    </div>
    <Portal>
      <Combobox.Positioner class="z-50">
        <Combobox.Content>
          {#each places as place (place.label)}
            <Combobox.Item item={place} class="my-0! justify-start gap-2 text-sm">
              <MapPinIcon class="text-primary-400 size-4 shrink-0" />
              <Combobox.ItemText class="text-left">{place.label}</Combobox.ItemText>
            </Combobox.Item>
          {/each}
        </Combobox.Content>
      </Combobox.Positioner>
    </Portal>
  </Combobox>

  {#if origin}
    <div class="flex min-w-0 items-center gap-1.5 text-xs" data-testid="event-map-origin">
      <MapPinIcon class="text-primary-400 size-3.5 shrink-0" />
      <span class="truncate" title={origin.label}>From <strong>{origin.label}</strong></span>
      <button
        type="button"
        class="btn-icon btn-icon-sm hover:preset-tonal-error size-6"
        aria-label="Clear starting point"
        title="Clear starting point"
        onclick={() => onchange(null)}><XIcon class="size-3.5" /></button>
    </div>
  {/if}
  {#if message}
    <p class="text-warning-400 text-xs">{message}</p>
  {:else if pending}
    <p class="text-warning-400 text-xs" data-testid="event-map-location-pending">Pick a place from the list to set your starting point.</p>
  {/if}
</div>
