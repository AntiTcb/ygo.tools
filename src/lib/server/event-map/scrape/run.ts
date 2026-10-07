import type { D1Database } from '@cloudflare/workers-types/index';
import tzLookup from '@photostructure/tz-lookup';
import { geocodePendingVenues, type GeocodeRunSummary } from '../geocode/pipeline';
import { parseEventList, parsePage, ParseError, type ScrapedEvent, type ScrapedVenue } from './parse';
import { SOURCES } from './sources';

const USER_AGENT = 'ygo-event-map/1.0 (community event calendar; fetches every 6 hours)';
/** D1 batches are chunked to keep each one well under statement/time limits. */
const WRITE_CHUNK = 100;

export interface ScrapeEnv {
  DB: D1Database;
  /** Only needed for the Mapbox fallback. */
  MAPBOX_SECRET_TOKEN?: string;
  /** "false" disables the paid Mapbox fallback. */
  GEOCODE_MAPBOX_FALLBACK?: string;
  /** Max Nominatim requests per run (default 25). */
  GEOCODE_NOMINATIM_LIMIT?: string;
  /** Contact email/URL sent to Nominatim, as its usage policy asks. */
  NOMINATIM_CONTACT?: string;
}

export interface ScrapeOptions {
  /** Skip fetching/parsing and only geocode pending venues. */
  geocodeOnly?: boolean;
}

export interface ScrapeSummary {
  runId: number;
  eventsSeen: number;
  eventsRemoved: number;
  venuesGeocoded: number;
  venuesPending: number;
  geocoding: GeocodeRunSummary;
  tables: { url: string; tableId: string; rows: number }[];
}

export const runScrape = async (env: ScrapeEnv, opts: ScrapeOptions = {}): Promise<ScrapeSummary> => {
  const { DB } = env;
  const run = await DB.prepare(`INSERT INTO scrape_runs DEFAULT VALUES RETURNING id`).first<{
    id: number;
  }>();
  const runId = run!.id;

  try {
    let eventsSeen = 0;
    let eventsRemoved = 0;
    const tables: ScrapeSummary['tables'] = [];

    if (!opts.geocodeOnly) {
      const events: ScrapedEvent[] = [];
      for (const source of SOURCES) {
        const res = await fetch(source.url, { headers: { 'user-agent': USER_AGENT } });
        if (!res.ok) throw new Error(`GET ${source.url} failed: ${res.status}`);
        const html = await res.text();
        const page = source.kind === 'tablepress' ? parsePage(html, source) : parseEventList(html, source);
        // An empty or missing table almost always means the page layout changed;
        // bail out rather than marking every event as removed. (Event-list pages
        // can legitimately be empty between seasons; their parser throws instead
        // when the page structure is missing.)
        if (source.kind === 'tablepress' && (page.tables.length === 0 || page.tables.some((t) => t.rows === 0))) {
          throw new ParseError(`No event rows parsed from ${source.url}`);
        }
        tables.push(...page.tables.map((t) => ({ url: source.url, tableId: t.tableId, rows: t.rows })));
        events.push(...page.events);
      }

      const stamp = new Date().toISOString();
      await writeEvents(DB, events, stamp);
      eventsSeen = events.length;

      // Events that dropped off a page are marked removed, but only if they
      // haven't happened yet: pages like the YCS list only show upcoming events,
      // and finished events should stay in the calendar's history.
      const removed = await DB.prepare(
        `UPDATE events SET removed_at = ?1
				WHERE removed_at IS NULL AND last_seen_at <> ?1
					AND COALESCE(end_date, date) >= date('now', '-1 day')`,
      )
        .bind(stamp)
        .run();
      eventsRemoved = removed.meta.changes;
    }

    const geocoding = await geocodePendingVenues(DB, {
      nominatimLimit: Number(env.GEOCODE_NOMINATIM_LIMIT) || 25,
      nominatimContact: env.NOMINATIM_CONTACT || undefined,
      mapboxFallback: env.GEOCODE_MAPBOX_FALLBACK !== 'false',
      mapboxToken: env.MAPBOX_SECRET_TOKEN,
    });
    if (!env.NOMINATIM_CONTACT) {
      console.warn('NOMINATIM_CONTACT is not set; Nominatim asks clients to identify themselves');
    }
    await fillTimezones(DB);

    await DB.prepare(
      `UPDATE scrape_runs SET finished_at = datetime('now'), status = 'ok',
				events_seen = ?, events_removed = ?, venues_geocoded = ? WHERE id = ?`,
    )
      .bind(eventsSeen, eventsRemoved, geocoding.geocoded, runId)
      .run();

    return {
      runId,
      eventsSeen,
      eventsRemoved,
      venuesGeocoded: geocoding.geocoded,
      venuesPending: geocoding.pending,
      geocoding,
      tables,
    };
  } catch (err) {
    await DB.prepare(`UPDATE scrape_runs SET finished_at = datetime('now'), status = 'error', error = ? WHERE id = ?`)
      .bind(String(err instanceof Error ? (err.stack ?? err.message) : err), runId)
      .run();
    throw err;
  }
};

const writeEvents = async (DB: D1Database, events: ScrapedEvent[], stamp: string) => {
  const venues = new Map<string, ScrapedVenue>();
  for (const e of events) if (e.venue) venues.set(e.venue.id, e.venue);

  // Venues the source page already places on the map skip geocoding entirely.
  const venueStmt = DB.prepare(
    `INSERT INTO venues (id, name, address, city, state, country, lat, lng, geocode_status,
			geocode_source, geocoded_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
			CASE WHEN ?7 IS NULL THEN 'pending' ELSE 'ok' END,
			CASE WHEN ?7 IS NULL THEN NULL ELSE 'source' END,
			CASE WHEN ?7 IS NULL THEN NULL ELSE datetime('now') END)
		ON CONFLICT (id) DO UPDATE SET name = excluded.name, city = excluded.city, state = excluded.state,
			timezone = CASE WHEN excluded.lat IS NOT NULL AND excluded.lat IS NOT venues.lat
				THEN NULL ELSE venues.timezone END,
			lat = COALESCE(excluded.lat, venues.lat),
			lng = COALESCE(excluded.lng, venues.lng),
			geocode_status = CASE WHEN excluded.lat IS NOT NULL THEN 'ok' ELSE venues.geocode_status END,
			geocode_source = CASE WHEN excluded.lat IS NOT NULL THEN 'source' ELSE venues.geocode_source END`,
  );
  const eventStmt = DB.prepare(
    `INSERT INTO events (id, type, region, host, date, end_date, start_time, tz_note, formats, venue_id,
			is_remote, remote_url, state, country, capacity, email, phone, dragon_duel, vendor_info,
			source_url, last_seen_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?21, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
		ON CONFLICT (id) DO UPDATE SET
			host = excluded.host, date = excluded.date, end_date = excluded.end_date,
			start_time = excluded.start_time, tz_note = excluded.tz_note,
			formats = excluded.formats, remote_url = excluded.remote_url, state = excluded.state,
			country = excluded.country, capacity = excluded.capacity, email = excluded.email,
			phone = excluded.phone, dragon_duel = excluded.dragon_duel, vendor_info = excluded.vendor_info,
			source_url = excluded.source_url, last_seen_at = excluded.last_seen_at, removed_at = NULL`,
  );

  const statements = [
    ...[...venues.values()].map((v) => venueStmt.bind(v.id, v.name, v.address, v.city, v.state, v.country, v.lat ?? null, v.lng ?? null)),
    ...events.map((e) =>
      eventStmt.bind(
        e.id,
        e.type,
        e.region,
        e.host,
        e.date,
        e.startTime,
        e.tzNote,
        JSON.stringify(e.formats),
        e.venue?.id ?? null,
        e.isRemote ? 1 : 0,
        e.remoteUrl,
        e.state,
        e.country,
        e.capacity,
        e.email,
        e.phone,
        e.dragonDuel === null ? null : e.dragonDuel ? 1 : 0,
        e.vendorInfo,
        e.sourceUrl,
        stamp,
        e.endDate,
      ),
    ),
  ];

  for (let i = 0; i < statements.length; i += WRITE_CHUNK) {
    await DB.batch(statements.slice(i, i + WRITE_CHUNK));
  }
};

/** Derives each located venue's IANA time zone from its coordinates (offline lookup). */
const fillTimezones = async (DB: D1Database) => {
  const { results } = await DB.prepare(`SELECT id, lat, lng FROM venues WHERE timezone IS NULL AND lat IS NOT NULL AND lng IS NOT NULL`).all<{
    id: string;
    lat: number;
    lng: number;
  }>();
  if (!results.length) return;

  const update = DB.prepare(`UPDATE venues SET timezone = ? WHERE id = ?`);
  const statements = results.flatMap((v) => {
    try {
      return [update.bind(tzLookup(v.lat, v.lng), v.id)];
    } catch {
      return []; // invalid coordinates; leave the time zone unknown
    }
  });
  for (let i = 0; i < statements.length; i += WRITE_CHUNK) {
    await DB.batch(statements.slice(i, i + WRITE_CHUNK));
  }
};
