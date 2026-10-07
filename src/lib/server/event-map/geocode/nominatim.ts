/**
 * OpenStreetMap Nominatim: free and global, results may be stored (ODbL — the
 * site must credit OpenStreetMap contributors).
 *
 * Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 * at most 1 request/second, a User-Agent that identifies the app, and cache
 * results (we store them in D1 and never look up a venue twice).
 */
import { countryCode, normalizeName, type GeocodeResult, type VenueToGeocode } from './shared';

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
/** Minimum spacing between requests, a little over the 1/s limit. */
export const NOMINATIM_INTERVAL_MS = 1100;

export interface NominatimOptions {
  /** Contact email or URL for the User-Agent / `email` parameter (policy asks for one). */
  contact?: string;
  fetcher?: typeof fetch;
}

export interface NominatimPlace {
  lat: string;
  lon: string;
  addresstype?: string;
  address?: Record<string, string>;
}

/** Results this coarse would put a pin in the wrong place entirely. */
const TOO_COARSE = new Set(['country', 'state', 'region', 'province', 'county', 'state_district']);

/** Address parts that can hold the venue's city, depending on the country. */
const CITY_KEYS = ['city', 'town', 'village', 'municipality', 'city_district', 'suburb', 'borough', 'county', 'state_district'];

/**
 * Strips unit/suite numbers ("Local 34", "Suite 104", "Lt 3B") that OSM doesn't
 * index and that make otherwise-valid addresses fail to match.
 */
export const cleanAddressForSearch = (address: string): string => {
  return address
    .replace(/\b(?:local(?:es)?|loc|lt|lote|suite|ste|unit|apt|piso|int|interior|depto|dpto)\b\.?\s*[\w-]+(?:\s*-\s*[\w-]+)?/gi, '')
    .replace(/\s*,\s*(?:,\s*)+/g, ', ')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .replace(/\s{2,}/g, ' ');
};

/**
 * Picks the first result that is specific enough and in the venue's city.
 * Without the city check, Nominatim happily matches a same-named street in
 * another city (seen: a Mexican venue placed 210 km away).
 */
export const pickNominatimResult = (places: NominatimPlace[], venue: Pick<VenueToGeocode, 'city'>): GeocodeResult | null => {
  const city = venue.city ? normalizeName(venue.city) : null;
  for (const p of places) {
    if (p.addresstype && TOO_COARSE.has(p.addresstype)) continue;
    if (city) {
      const parts = CITY_KEYS.map((k) => p.address?.[k]).filter((v): v is string => !!v);
      const inCity = parts.some((part) => {
        const n = normalizeName(part);
        return n === city || n.includes(city) || city.includes(n);
      });
      if (!inCity) continue;
    }
    const lat = Number(p.lat);
    const lng = Number(p.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
};

/**
 * Looks up one venue with a single request. Callers must space calls at least
 * NOMINATIM_INTERVAL_MS apart and cap how many they make per run.
 */
export const nominatimSearch = async (venue: VenueToGeocode, opts: NominatimOptions = {}): Promise<GeocodeResult | null> => {
  const fetcher = opts.fetcher ?? fetch;
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', cleanAddressForSearch(venue.address));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '5');
  const code = countryCode(venue.country);
  if (code) url.searchParams.set('countrycodes', code);
  if (opts.contact?.includes('@')) url.searchParams.set('email', opts.contact);

  const res = await fetcher(url, {
    headers: {
      'user-agent': `ygo-event-map/1.0${opts.contact ? ` (${opts.contact})` : ''}`,
      'accept-language': 'en',
    },
  });
  if (res.status === 429 || res.status === 403) {
    throw new Error(`Nominatim refused the request (${res.status}); check the usage policy`);
  }
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
  return pickNominatimResult((await res.json()) as NominatimPlace[], venue);
};
