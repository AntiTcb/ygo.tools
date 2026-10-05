import type { LngLat } from './types';

const EARTH_RADIUS_KM = 6371;
const KM_PER_MI = 1.609344;

/** Great-circle distance in kilometres. */
export const distanceKm = (a: LngLat, b: LngLat): number => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const toUnit = (km: number, unit: 'mi' | 'km'): number => {
  return unit === 'mi' ? km / KM_PER_MI : km;
};

export const fromUnit = (value: number, unit: 'mi' | 'km'): number => {
  return unit === 'mi' ? value * KM_PER_MI : value;
};

export const formatDistance = (km: number, unit: 'mi' | 'km'): string => {
  const v = toUnit(km, unit);
  return `${v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString()} ${unit}`;
};

/** "1 h 25 min" */
export const formatDuration = (seconds: number): string => {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
};
