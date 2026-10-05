/**
 * US Census Bureau geocoder: free, no API key, US states and territories only.
 * One batch request geocodes up to 10,000 addresses.
 * https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
 */
import type { GeocodeResult, VenueToGeocode } from './shared';

const BATCH_URL = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch';
export const CENSUS_BATCH_LIMIT = 10_000;

/** Countries whose addresses the Census geocoder covers (states, PR and island areas). */
export const isCensusCovered = (v: Pick<VenueToGeocode, 'country'>): boolean => {
  return v.country === 'United States';
};

const csvField = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * Geocodes US venues in one request. Returns hits keyed by venue id; venues
 * Census couldn't match (or matched ambiguously) are simply absent.
 */
export const censusBatch = async (venues: VenueToGeocode[], fetcher: typeof fetch = fetch): Promise<Map<string, GeocodeResult>> => {
  if (!venues.length) return new Map();
  if (venues.length > CENSUS_BATCH_LIMIT) {
    throw new Error(`censusBatch accepts at most ${CENSUS_BATCH_LIMIT} addresses`);
  }

  // Columns: id, street, city, state, zip. The whole address in the street
  // column matches as well as splitting it (checked against real venues).
  const csv = `${venues.map((v) => `${csvField(v.id)},${csvField(v.address)},,,`).join('\n')}\n`;
  const form = new FormData();
  form.set('benchmark', 'Public_AR_Current');
  form.set('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv');

  const res = await fetcher(BATCH_URL, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Census batch geocoding failed: ${res.status}`);
  return parseCensusResponse(await res.text());
};

/**
 * Parses the batch response. Each line is quoted CSV:
 *   "id","input address","Match","Exact","matched address","lng,lat","tiger id","side"
 * or "id","input address","No_Match" / "Tie".
 */
export const parseCensusResponse = (text: string): Map<string, GeocodeResult> => {
  const hits = new Map<string, GeocodeResult>();
  for (const line of text.split(/\r?\n/)) {
    const cols = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => (m[1] ?? '').replace(/""/g, '"'));
    const [id, , status, , , coordinates] = cols;
    if (!id || status !== 'Match' || !coordinates) continue;
    const [lng = NaN, lat = NaN] = coordinates.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) hits.set(id, { lat, lng });
  }
  return hits;
};
