export type Region = 'na' | 'latam';
export type EventType = 'regional' | 'ots' | 'ycs';

export const REGIONS: Record<Region, { label: string; shortLabel: string; distanceUnit: 'mi' | 'km' }> = {
  na: { label: 'North America', shortLabel: 'NA', distanceUnit: 'mi' },
  latam: { label: 'Latin America', shortLabel: 'LATAM', distanceUnit: 'km' },
};

/** The region in a `?region=` query param; North America unless it names another known region. */
export const parseRegion = (value: string | null | undefined): Region => (value === 'latam' ? 'latam' : 'na');

/** Query params for a region: North America is the default and stays out of the URL. */
export const regionParams = (region: Region): URLSearchParams => new URLSearchParams(region === 'na' ? '' : `region=${region}`);

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  regional: 'Regional',
  ots: 'OTS Championship',
  ycs: 'YCS',
};

export interface Venue {
  name: string | null;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/** An event as served to the browser. */
export interface EventItem {
  id: string;
  type: EventType;
  region: Region;
  host: string;
  /** YYYY-MM-DD, local to the venue. */
  date: string;
  /** Last day (inclusive) of a multi-day event such as a Friday–Sunday YCS; null otherwise. */
  endDate: string | null;
  /** HH:MM (24h), local to the venue. Null when the source only lists a date. */
  startTime: string | null;
  tzNote: string | null;
  /**
   * Time zone the start time is in: a fixed offset when the listing names one
   * (e.g. "MST"), else the venue's IANA zone. Null when unknown.
   */
  timezone: string | null;
  formats: string[];
  isRemote: boolean;
  remoteUrl: string | null;
  venue: Venue | null;
  state: string | null;
  country: string;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  dragonDuel: boolean | null;
  vendorInfo: string | null;
  sourceUrl: string;
}

export interface LngLat {
  lng: number;
  lat: number;
}

/** The span of dates the calendar is currently showing. */
export interface CalendarRange {
  /** Inclusive start, YYYY-MM-DD. */
  start: string;
  /** Exclusive end, YYYY-MM-DD. */
  end: string;
  /** Human-readable name, e.g. "October 2026" or "the week of Sat, Oct 10, 2026". */
  title: string;
  kind: 'month' | 'week';
}
