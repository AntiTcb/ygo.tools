/** Browser-side Mapbox calls, made with the public token. */
import type { LineString } from 'geojson';
import type { LngLat, Region } from './types';

export interface Place extends LngLat {
  label: string;
}

const SEARCH_COUNTRIES: Record<Region, string | undefined> = {
  na: 'us,ca',
  latam: undefined, // spans too many countries to restrict usefully
};

/** Forward-geocodes a city/address typed by the user (temporary geocoding, not stored). */
export const searchPlaces = async (query: string, token: string, region: Region, signal?: AbortSignal): Promise<Place[]> => {
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '5');
  url.searchParams.set('types', 'place,postcode,locality,neighborhood,address');
  const countries = SEARCH_COUNTRIES[region];
  if (countries) url.searchParams.set('country', countries);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as {
    features: {
      properties: {
        full_address?: string;
        name: string;
        coordinates: { latitude: number; longitude: number };
      };
    }[];
  };
  return data.features.map(({ properties: p }) => ({
    label: p.full_address ?? p.name,
    lat: p.coordinates.latitude,
    lng: p.coordinates.longitude,
  }));
};

export interface Route {
  geometry: LineString;
  /** Seconds */
  duration: number;
  /** Metres */
  distance: number;
}

export const drivingRoute = async (from: LngLat, to: LngLat, token: string, signal?: AbortSignal): Promise<Route | null> => {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('access_token', token);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Directions failed (${res.status})`);
  const data = (await res.json()) as { routes: Route[] };
  return data.routes[0] ?? null;
};
