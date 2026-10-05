import { buildIcs } from '$lib/event-map/calendar-links';
import { addDays, today } from '$lib/event-map/dates';
import { applyFilters, parseFilters } from '$lib/event-map/filters';
import { EVENT_TYPE_LABELS, REGIONS, parseRegion } from '$lib/event-map/types';
import { eventMapDb } from '$lib/server/event-map/db';
import { listEvents } from '$lib/server/event-map/events';
import type { RequestHandler } from './$types';

/**
 * Subscribable iCalendar feed: /event-map/calendar.ics?region=na plus the same
 * filter params as the map page. `lat`/`lng` enable the `radius` filter.
 */
export const GET: RequestHandler = async ({ url, platform }) => {
  const region = parseRegion(url.searchParams.get('region'));

  const filters = { ...parseFilters(url.searchParams), past: true };
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const origin = url.searchParams.has('lat') && url.searchParams.has('lng') ? { lat, lng } : null;

  // Keep a little history so recently finished events don't vanish from calendars.
  const since = addDays(today(), -30);
  const events = applyFilters(await listEvents(eventMapDb(platform), region), filters, {
    origin,
    unit: REGIONS[region].distanceUnit,
  }).filter((e) => (e.endDate ?? e.date) >= since);

  const types = filters.types.length ? filters.types : (['regional', 'ots', 'ycs'] as const);
  const name = `Yu-Gi-Oh! ${types.map((t) => EVENT_TYPE_LABELS[t]).join(' & ')} – ${REGIONS[region].label}`;
  // Same filters, as a link back to the page.
  const pageUrl = new URL('/event-map', url);
  pageUrl.search = url.search;

  return new Response(buildIcs(events, { name, url: pageUrl.toString(), refreshHours: 6 }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=1800',
    },
  });
};
