/** Types and helpers shared by the geocoding providers. */

export interface VenueToGeocode {
  id: string;
  /** Street address lines joined with ", " (as stored in venues.address). */
  address: string;
  city: string | null;
  state: string | null;
  country: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

export type GeocodeSource = 'source' | 'census' | 'nominatim' | 'mapbox';

const COUNTRY_CODES: Record<string, string> = {
  'United States': 'us',
  Canada: 'ca',
  Mexico: 'mx',
  Argentina: 'ar',
  Aruba: 'aw',
  Bahamas: 'bs',
  Barbados: 'bb',
  Belize: 'bz',
  Bolivia: 'bo',
  Brazil: 'br',
  Chile: 'cl',
  Colombia: 'co',
  'Costa Rica': 'cr',
  'Dominican Republic': 'do',
  Ecuador: 'ec',
  'El Salvador': 'sv',
  Guatemala: 'gt',
  Honduras: 'hn',
  Nicaragua: 'ni',
  Panama: 'pa',
  Paraguay: 'py',
  Peru: 'pe',
  'Puerto Rico': 'pr',
  'Trinidad & Tobago': 'tt',
  Uruguay: 'uy',
  Venezuela: 've',
};

/** ISO 3166-1 alpha-2 code (lowercase) for a country name, if known. */
export const countryCode = (country: string): string | undefined => {
  return COUNTRY_CODES[country];
};

/** Lowercase, accent-free, alphanumeric-only form for loose name comparisons. */
export const normalizeName = (s: string): string => {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};
