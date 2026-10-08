import { today, weekendOf } from './dates';
import { distanceKm, fromUnit } from './geo';
import type { EventItem, EventType, LngLat } from './types';

/** Filters are stored in the URL query string so filtered views can be shared. */
export interface Filters {
  /** Empty means all types. */
  types: EventType[];
  /** Regional formats, e.g. "Advanced". Empty means all. */
  formats: string[];
  /** Saturday of the selected weekend (YYYY-MM-DD), or null for all dates. */
  weekend: string | null;
  state: string | null;
  /**
   * Radius in the region's distance unit, only applied when an origin is known.
   * `'any'` turns the distance filter off; null means DEFAULT_RADIUS.
   */
  radius: number | 'any' | null;
  /** Include events before today. */
  past: boolean;
}

const EVENT_TYPES: EventType[] = ['regional', 'ots', 'ycs'];

/** Distance applied once a starting point is set, until the viewer picks another. */
export const DEFAULT_RADIUS: Record<'mi' | 'km', number> = { mi: 100, km: 200 };

/** The radius actually in effect: a number, or null when distance isn't filtered. */
export const effectiveRadius = (f: Filters, hasOrigin: boolean, unit: 'mi' | 'km'): number | null => {
  if (!hasOrigin || f.radius === 'any') return null;
  return f.radius ?? DEFAULT_RADIUS[unit];
};

const list = (params: Pick<URLSearchParams, 'get'>, key: string): string[] => {
  return (params.get(key) ?? '').split(',').filter(Boolean);
};

export const parseFilters = (params: Pick<URLSearchParams, 'get'>): Filters => {
  const weekend = params.get('weekend');
  const rawRadius = params.get('radius');
  const radius = Number(rawRadius);
  return {
    types: list(params, 'type').filter((t): t is EventType => EVENT_TYPES.includes(t as EventType)),
    formats: list(params, 'format'),
    weekend: weekend && /^\d{4}-\d{2}-\d{2}$/.test(weekend) ? weekend : null,
    state: params.get('state') || null,
    radius: rawRadius === 'any' ? 'any' : radius > 0 ? radius : null,
    past: params.get('past') === '1',
  };
};

export const filtersToParams = (f: Filters): URLSearchParams => {
  const p = new URLSearchParams();
  if (f.types.length) p.set('type', f.types.join(','));
  if (f.formats.length) p.set('format', f.formats.join(','));
  if (f.weekend) p.set('weekend', f.weekend);
  if (f.state) p.set('state', f.state);
  if (f.radius) p.set('radius', String(f.radius));
  if (f.past) p.set('past', '1');
  return p;
};

export interface FilterContext {
  origin?: LngLat | null;
  unit: 'mi' | 'km';
  /** Defaults to the viewer's today. */
  today?: string;
}

export const applyFilters = (events: EventItem[], f: Filters, ctx: FilterContext): EventItem[] => {
  const cutoff = ctx.today ?? today();
  const radius = effectiveRadius(f, !!ctx.origin, ctx.unit);
  const radiusKm = radius !== null ? fromUnit(radius, ctx.unit) : null;

  return events.filter((e) => {
    if (!f.past && !f.weekend && (e.endDate ?? e.date) < cutoff) return false;
    if (f.types.length && !f.types.includes(e.type)) return false;
    if (f.formats.length && e.type === 'regional' && !e.formats.some((x) => f.formats.includes(x))) return false;
    if (f.weekend && weekendOf(e.date) !== f.weekend) return false;
    if (f.state && e.state !== f.state) return false;
    if (radiusKm !== null && ctx.origin && !e.isRemote) {
      const v = e.venue;
      if (v?.lat == null || v.lng == null) return false;
      if (distanceKm(ctx.origin, { lat: v.lat, lng: v.lng }) > radiusKm) return false;
    }
    return true;
  });
};
