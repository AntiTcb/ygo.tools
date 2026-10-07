<script lang="ts">
  import { onMount } from 'svelte';
  import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap, Marker } from 'mapbox-gl';
  import type { MapArea } from '$lib/event-map/map-areas';
  import type { EventItem, LngLat } from '$lib/event-map/types';
  import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
  import LocateFixed from '~icons/lucide/locate-fixed?raw';

  interface Props {
    token: string;
    area: MapArea;
    /** Events to pin. Remote events and events without coordinates are skipped. */
    events: EventItem[];
    selectedIds: string[];
    origin: LngLat | null;
    route?: LineString | null;
    /**
     * Frame the pinned events (e.g. a weekend or state is selected). Otherwise
     * the map rests on the area's default view.
     */
    fitToEvents: boolean;
    /** Small inset map: no zoom buttons, tighter padding. */
    compact?: boolean;
    /** Extra bottom padding (px) when framing, e.g. to keep pins clear of overlaid insets. */
    reserveBottom?: number;
    onselect: (id: string) => void;
  }

  let { token, area, events, selectedIds, origin, route = null, fitToEvents, compact = false, reserveBottom = 0, onselect }: Props = $props();

  const pad = (p: number) => ({ top: p, right: p, bottom: p + reserveBottom, left: p });

  let el: HTMLDivElement;
  let map = $state<MapboxMap | null>(null);
  let originMarker: Marker | null = null;
  let mapboxgl: typeof import('mapbox-gl').default;

  type Coord = [number, number];
  /** Pin coordinates for each event that has a physical, geocoded venue. */
  const coordsOf = (list: EventItem[]): Coord[] =>
    list.flatMap((e) => {
      const c = coordOf(e);
      return c ? [c] : [];
    });
  const coordOf = (e: EventItem): Coord | null => (!e.isRemote && e.venue?.lat != null && e.venue.lng != null ? [e.venue.lng, e.venue.lat] : null);

  const toGeoJson = (list: EventItem[]): FeatureCollection<Point> => {
    return {
      type: 'FeatureCollection',
      features: list.flatMap((e) => {
        const c = coordOf(e);
        return c
          ? [
              {
                type: 'Feature',
                properties: { id: e.id, type: e.type },
                geometry: { type: 'Point', coordinates: c },
              },
            ]
          : [];
      }),
    };
  };

  const cssColor = (name: string): string => {
    // Mapbox can't read CSS variables or parse DaisyUI's oklch() colours, so
    // resolve the variable and paint it to a pixel to get rgb().
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    // Probe inside the map element: the event colours are scoped to `.event-map`.
    el.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();

    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return color;
    ctx.canvas.width = ctx.canvas.height = 1;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  };

  /** Applies the theme's colours to the custom layers. */
  const applyColors = (m: MapboxMap) => {
    const regional = cssColor('--ev-regional');
    const ots = cssColor('--ev-ots');
    const ycs = cssColor('--ev-ycs');
    const accent = cssColor('--ev-route');
    const pin: ExpressionSpecification = ['match', ['get', 'type'], 'regional', regional, 'ycs', ycs, ots];
    m.setPaintProperty('route', 'line-color', accent);
    m.setPaintProperty('clusters', 'circle-color', cssColor('--color-surface-700'));
    m.setPaintProperty('cluster-count', 'text-color', cssColor('--color-surface-50'));
    m.setPaintProperty('events', 'circle-color', pin);
    m.setPaintProperty('selected-halo', 'circle-color', accent);
    m.setPaintProperty('selected', 'circle-color', pin);
  };

  const addLayers = (m: MapboxMap) => {
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
    m.addSource('events', {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterRadius: compact ? 30 : 40,
      clusterMaxZoom: 11,
    });
    // Selected events live in their own unclustered source so they always show.
    m.addSource('selected', { type: 'geojson', data: empty });
    m.addSource('route', { type: 'geojson', data: empty });

    // Keep custom layers unaffected by the Standard style's day/night lighting.
    const emissive = 1;
    m.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 5, 'line-opacity': 0.9, 'line-emissive-strength': emissive },
    });
    m.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'events',
      filter: ['has', 'point_count'],
      paint: {
        'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        'circle-emissive-strength': emissive,
      },
    });
    m.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'events',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
      paint: { 'text-emissive-strength': emissive },
    });
    m.addLayer({
      id: 'events',
      type: 'circle',
      source: 'events',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': compact ? 6 : 7,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-emissive-strength': emissive,
      },
    });
    m.addLayer({
      id: 'selected-halo',
      type: 'circle',
      source: 'selected',
      paint: { 'circle-radius': 15, 'circle-opacity': 0.35, 'circle-emissive-strength': emissive },
    });
    m.addLayer({
      id: 'selected',
      type: 'circle',
      source: 'selected',
      paint: {
        'circle-radius': 9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
        'circle-emissive-strength': emissive,
      },
    });

    for (const layer of ['events', 'selected']) {
      m.on('click', layer, (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onselect(String(id));
      });
    }
    m.on('click', 'clusters', (e) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const center = feature.geometry.coordinates as Coord;
      (m.getSource('events') as GeoJSONSource).getClusterExpansionZoom(feature.properties!.cluster_id, (err, zoom) => {
        if (!err && zoom != null) m.easeTo({ center, zoom });
      });
    });
    for (const layer of ['events', 'selected', 'clusters']) {
      m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
    }
  };

  onMount(() => {
    let instance: MapboxMap | undefined;
    // The component can unmount while mapbox-gl is still loading (e.g. an inset
    // that disappears when the calendar range changes); don't build a map then.
    let destroyed = false;

    (async () => {
      mapboxgl = (await import('mapbox-gl')).default;
      if (destroyed) return;
      mapboxgl.accessToken = token;
      instance = new mapboxgl.Map({
        container: el,
        style: 'mapbox://styles/mapbox/standard',
        // ygo.tools is dark-themed throughout.
        config: { basemap: { lightPreset: 'night' } },
        projection: 'mercator',
        bounds: area.bounds,
        fitBoundsOptions: { padding: pad(compact ? 8 : 24) },
        attributionControl: !compact,
      });
      if (!compact) instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      else instance.addControl(new mapboxgl.AttributionControl({ compact: true }));

      instance.on('load', () => {
        addLayers(instance!);
        applyColors(instance!);
        map = instance!;
      });
    })();

    return () => {
      destroyed = true;
      instance?.remove();
    };
  });

  const selectedSet = $derived(new Set(selectedIds));

  // Pins: unselected events cluster; selected ones are drawn on top, unclustered.
  $effect(() => {
    if (!map) return;
    (map.getSource('events') as GeoJSONSource).setData(toGeoJson(events.filter((e) => !selectedSet.has(e.id))));
    (map.getSource('selected') as GeoJSONSource).setData(toGeoJson(events.filter((e) => selectedSet.has(e.id))));
  });

  // Framing, in priority order: route > selected events > filtered events > default view.
  // Clearing the selection therefore returns the map to where it started.
  let framed = false;
  $effect(() => {
    if (!map) return;
    const padding = pad(compact ? 16 : 56);
    const duration = framed ? 700 : 0;
    framed = true;

    let coords: Coord[] = [];
    if (route) coords = route.coordinates.map(([x, y]) => [x, y] as Coord);
    else if (selectedSet.size) {
      coords = coordsOf(events.filter((e) => selectedSet.has(e.id)));
    }
    if (!coords.length && !route && fitToEvents) {
      coords = coordsOf(events);
    }

    if (!coords.length) {
      map.fitBounds(area.bounds, { padding: pad(compact ? 8 : 24), duration });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(coords[0], coords[0]);
    for (const c of coords) bounds.extend(c);
    map.fitBounds(bounds, { padding, maxZoom: route ? 14 : 11.5, duration });
  });

  // User location marker.
  $effect(() => {
    if (!map) return;
    originMarker?.remove();
    if (!origin) {
      originMarker = null;
      return;
    }
    const markerEl = document.createElement('div');
    markerEl.className = 'origin-marker';
    markerEl.title = 'Starting point';
    markerEl.innerHTML = LocateFixed; // bundled, trusted SVG string
    originMarker = new mapboxgl.Marker({ element: markerEl }).setLngLat([origin.lng, origin.lat]).addTo(map);
  });

  // Driving route.
  $effect(() => {
    if (!map) return;
    (map.getSource('route') as GeoJSONSource).setData(
      route ? { type: 'Feature', properties: {}, geometry: route } : { type: 'FeatureCollection', features: [] },
    );
  });
</script>

<div bind:this={el} class="h-full w-full"></div>
