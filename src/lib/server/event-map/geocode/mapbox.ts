/**
 * Venue geocoding via the Mapbox Geocoding v6 batch endpoint — the paid last
 * resort in the geocoding pipeline (see ./pipeline.ts).
 *
 * Results are stored in D1, which Mapbox only permits for *permanent* geocoding
 * (`permanent=true`, $5 per 1,000 lookups, requires a billing method).
 */
import { countryCode, type GeocodeResult, type VenueToGeocode } from './shared';

const BATCH_URL = 'https://api.mapbox.com/search/geocode/v6/batch';
/** Mapbox caps batch requests at 50 queries. */
export const GEOCODE_BATCH_SIZE = 50;

interface MapboxFeature {
  properties: { coordinates: { latitude: number; longitude: number } };
}

/**
 * Geocodes up to GEOCODE_BATCH_SIZE addresses in one request. The result array
 * matches the input order; entries are null when Mapbox found nothing.
 */
export const geocodeBatch = async (
  queries: Pick<VenueToGeocode, 'address' | 'country'>[],
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<(GeocodeResult | null)[]> => {
  if (queries.length === 0) return [];
  if (queries.length > GEOCODE_BATCH_SIZE) {
    throw new Error(`geocodeBatch accepts at most ${GEOCODE_BATCH_SIZE} queries`);
  }

  const body = queries.map(({ address, country }) => {
    const code = countryCode(country);
    return {
      // q is capped at 256 characters by the API.
      q: (code ? address : `${address}, ${country}`).slice(0, 256),
      ...(code && { country: code }),
      types: ['address', 'street', 'postcode', 'place'],
      limit: 1,
    };
  });

  const url = new URL(BATCH_URL);
  url.searchParams.set('access_token', token);
  url.searchParams.set('permanent', 'true');

  const res = await fetcher(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Mapbox batch geocoding failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { batch: { features: MapboxFeature[] }[] };
  return data.batch.map((r) => {
    const coords = r.features[0]?.properties.coordinates;
    return coords ? { lat: coords.latitude, lng: coords.longitude } : null;
  });
};
