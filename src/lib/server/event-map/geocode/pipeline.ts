/**
 * Geocodes pending venues with free providers first and Mapbox only as a last
 * resort, so steady-state geocoding costs (close to) nothing:
 *
 *   1. Census (free, one batch request) — US states and territories
 *   2. Nominatim / OpenStreetMap (free, 1 req/s) — everything Census didn't place,
 *      up to a per-run request budget
 *   3. Mapbox permanent geocoding ($5 / 1,000) — venues the free providers
 *      couldn't place; each venue is sent to Mapbox at most once, ever
 *
 * Coordinates published by the source page itself (e.g. YCS JSON-LD) are stored
 * at scrape time and never reach this pipeline.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index';
import { censusBatch, isCensusCovered } from './census';
import { geocodeBatch, GEOCODE_BATCH_SIZE } from './mapbox';
import { NOMINATIM_INTERVAL_MS, nominatimSearch } from './nominatim';
import type { GeocodeResult, GeocodeSource, VenueToGeocode } from './shared';

export interface GeocodeConfig {
  /** Max Nominatim requests per run (keeps runs short and well within the usage policy). */
  nominatimLimit: number;
  /** Contact email/URL sent to Nominatim, as its usage policy asks. */
  nominatimContact?: string;
  /** Use Mapbox for venues the free providers couldn't place. */
  mapboxFallback: boolean;
  mapboxToken?: string;
  /** Max venues considered per run. */
  maxVenues?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface GeocodeRunSummary {
  geocoded: number;
  bySource: Record<Exclude<GeocodeSource, 'source'>, number>;
  failed: number;
  /** Venues still waiting (e.g. the Nominatim budget ran out); retried next run. */
  pending: number;
}

interface PendingVenue extends VenueToGeocode {
  mapbox_attempted: number;
}

/** Pending venues, plus failed ones due a weekly retry in case the source fixed a typo. */
const PENDING_WHERE = `geocode_status = 'pending'
	OR (geocode_status = 'failed' AND geocoded_at < datetime('now', '-7 days'))`;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const geocodePendingVenues = async (DB: D1Database, config: GeocodeConfig): Promise<GeocodeRunSummary> => {
  const fetcher = config.fetcher ?? fetch;
  const sleep = config.sleep ?? defaultSleep;
  const { results: venues } = await DB.prepare(
    `SELECT id, address, city, state, country, mapbox_attempted FROM venues
		WHERE ${PENDING_WHERE}
		ORDER BY geocode_status = 'failed', created_at
		LIMIT ?`,
  )
    .bind(config.maxVenues ?? 2000)
    .all<PendingVenue>();

  const hits = new Map<string, { result: GeocodeResult; source: GeocodeSource }>();
  const record = (source: GeocodeSource) => (id: string, result: GeocodeResult | null) => {
    if (result) hits.set(id, { result, source });
  };

  // 1. Census
  const usVenues = venues.filter(isCensusCovered);
  if (usVenues.length) {
    try {
      const census = await censusBatch(usVenues, fetcher);
      for (const [id, result] of census) record('census')(id, result);
    } catch (err) {
      // Census outages shouldn't stall geocoding; Nominatim picks these up.
      console.warn('Census geocoding failed; falling back', err);
    }
  }

  // 2. Nominatim, sequentially and rate-limited, within the per-run budget
  const nominatimTried = new Set<string>();
  for (const v of venues) {
    if (hits.has(v.id)) continue;
    if (nominatimTried.size >= config.nominatimLimit) break;
    if (nominatimTried.size) await sleep(NOMINATIM_INTERVAL_MS);
    try {
      record('nominatim')(v.id, await nominatimSearch(v, { contact: config.nominatimContact, fetcher }));
      nominatimTried.add(v.id);
    } catch (err) {
      console.warn('Nominatim unavailable; stopping for this run', err);
      break;
    }
  }

  // 3. Mapbox, once per venue, only after the free providers have had their turn
  const mapboxEnabled = config.mapboxFallback && !!config.mapboxToken && !config.mapboxToken.endsWith('REPLACE_ME');
  const mapboxTried = new Set<string>();
  if (mapboxEnabled) {
    const candidates = venues.filter((v) => !hits.has(v.id) && nominatimTried.has(v.id) && !v.mapbox_attempted);
    for (let i = 0; i < candidates.length; i += GEOCODE_BATCH_SIZE) {
      const chunk = candidates.slice(i, i + GEOCODE_BATCH_SIZE);
      const coords = await geocodeBatch(chunk, config.mapboxToken!, fetcher);
      chunk.forEach((v, j) => {
        mapboxTried.add(v.id);
        record('mapbox')(v.id, coords[j] ?? null);
      });
    }
  }

  // Write results. A venue fails only once every applicable stage has tried it;
  // venues the Nominatim budget didn't reach stay pending for the next run.
  const success = DB.prepare(
    `UPDATE venues SET lat = ?, lng = ?, geocode_status = 'ok', geocode_source = ?,
			geocoded_at = datetime('now'), timezone = NULL,
			mapbox_attempted = mapbox_attempted OR ?
		WHERE id = ?`,
  );
  const failure = DB.prepare(
    `UPDATE venues SET geocode_status = 'failed', geocoded_at = datetime('now'),
			mapbox_attempted = mapbox_attempted OR ?
		WHERE id = ?`,
  );
  const statements: D1PreparedStatement[] = [];
  const bySource = { census: 0, nominatim: 0, mapbox: 0 };
  let failed = 0;
  for (const v of venues) {
    const usedMapbox = mapboxTried.has(v.id) ? 1 : 0;
    const hit = hits.get(v.id);
    if (hit) {
      statements.push(success.bind(hit.result.lat, hit.result.lng, hit.source, usedMapbox, v.id));
      if (hit.source !== 'source') bySource[hit.source]++;
    } else if (nominatimTried.has(v.id) && (usedMapbox || v.mapbox_attempted || !mapboxEnabled)) {
      statements.push(failure.bind(usedMapbox, v.id));
      failed++;
    }
  }
  for (let i = 0; i < statements.length; i += 100) {
    await DB.batch(statements.slice(i, i + 100));
  }

  const pending = await DB.prepare(`SELECT COUNT(*) AS n FROM venues WHERE ${PENDING_WHERE}`).first<{
    n: number;
  }>();
  return { geocoded: hits.size, bySource, failed, pending: pending?.n ?? 0 };
};
