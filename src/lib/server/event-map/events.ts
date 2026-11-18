import type { D1Database } from '@cloudflare/workers-types/index';
import { eventTimeZone } from '#lib/event-map/event-time.js';
import type { EventItem, EventType, Region } from '#lib/event-map/types.js';

interface EventRow {
  id: string;
  type: EventType;
  region: Region;
  host: string;
  date: string;
  end_date: string | null;
  start_time: string | null;
  tz_note: string | null;
  formats: string;
  is_remote: number;
  remote_url: string | null;
  state: string | null;
  country: string;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  dragon_duel: number | null;
  vendor_info: string | null;
  source_url: string;
  venue_id: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  lat: number | null;
  lng: number | null;
  venue_timezone: string | null;
}

const SELECT = `SELECT e.*, v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
	v.lat, v.lng, v.timezone AS venue_timezone
	FROM events e LEFT JOIN venues v ON v.id = e.venue_id`;

const toItem = (r: EventRow): EventItem => {
  return {
    id: r.id,
    type: r.type,
    region: r.region,
    host: r.host,
    date: r.date,
    endDate: r.end_date,
    startTime: r.start_time,
    tzNote: r.tz_note,
    timezone: eventTimeZone(r.tz_note, r.venue_timezone),
    formats: JSON.parse(r.formats) as string[],
    isRemote: r.is_remote === 1,
    remoteUrl: r.remote_url,
    venue:
      r.venue_id && r.venue_address
        ? {
            name: r.venue_name,
            address: r.venue_address,
            city: r.venue_city,
            lat: r.lat,
            lng: r.lng,
          }
        : null,
    state: r.state,
    country: r.country,
    capacity: r.capacity,
    email: r.email,
    phone: r.phone,
    dragonDuel: r.dragon_duel === null ? null : r.dragon_duel === 1,
    vendorInfo: r.vendor_info,
    sourceUrl: r.source_url,
  };
};

/** All current (not removed) events for a region, ordered by date. */
export const listEvents = async (db: D1Database, region: Region): Promise<EventItem[]> => {
  const { results } = await db.prepare(`${SELECT} WHERE e.region = ? AND e.removed_at IS NULL ORDER BY e.date, e.host`).bind(region).all<EventRow>();
  return results.map(toItem);
};

export const getEvent = async (db: D1Database, id: string): Promise<EventItem | null> => {
  const row = await db.prepare(`${SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  return row ? toItem(row) : null;
};

/** When the data was last refreshed successfully, as an ISO-ish UTC timestamp. */
export const lastScrapedAt = async (db: D1Database): Promise<string | null> => {
  const row = await db.prepare(`SELECT finished_at FROM scrape_runs WHERE status = 'ok' ORDER BY id DESC LIMIT 1`).first<{ finished_at: string }>();
  return row?.finished_at ?? null;
};
