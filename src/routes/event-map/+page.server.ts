import { env } from '$env/dynamic/public';
import type { EventItem } from '$lib/event-map/types';
import { parseRegion } from '$lib/event-map/types';
import { eventMapDb } from '$lib/server/event-map/db';
import { lastScrapedAt, listEvents } from '$lib/server/event-map/events';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, platform, setHeaders }) => {
  // Only `region` is read here, so changing the other filter params doesn't re-run this load.
  const region = parseRegion(url.searchParams.get('region'));
  const db = eventMapDb(platform);

  let events: EventItem[] = [];
  let updatedAt: string | null = null;
  try {
    [events, updatedAt] = await Promise.all([listEvents(db, region), lastScrapedAt(db)]);
    // Data only changes when the scraper runs (every 6 hours).
    setHeaders({ 'cache-control': 'public, max-age=300' });
  } catch (err) {
    // e.g. a local/CI database without migrations applied: show the empty state instead of a 500.
    console.error('event map: failed to load events', err);
  }

  return {
    region,
    events,
    updatedAt,
    // Public (pk.*) token; restrict it to ygo.tools in the Mapbox dashboard.
    mapboxToken: env.PUBLIC_MAPBOX_TOKEN ?? '',
  };
};
