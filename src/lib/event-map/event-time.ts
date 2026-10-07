/**
 * Event start times are published as wall-clock times at the venue. These
 * helpers pin them to a real instant (via the venue's time zone) so they can be
 * shown in the viewer's time zone and exported unambiguously.
 */
import { formatTime } from './dates';
import type { EventItem } from './types';

/** UTC offsets (hours) for abbreviations that appear in listings, e.g. "10:00 AM MST". */
const ABBREVIATION_OFFSETS: Record<string, number> = {
  HST: -10,
  AKST: -9,
  AKDT: -8,
  PST: -8,
  PDT: -7,
  MST: -7,
  MDT: -6,
  CST: -6,
  CDT: -5,
  EST: -5,
  EDT: -4,
  AST: -4,
  ADT: -3,
};

/**
 * The time zone an event's listed time is in. An explicit abbreviation wins (it
 * says exactly which offset was meant); otherwise the venue's IANA zone.
 */
export const eventTimeZone = (tzNote: string | null, venueZone: string | null): string | null => {
  const offset = tzNote ? ABBREVIATION_OFFSETS[tzNote] : undefined;
  if (offset !== undefined) {
    // Etc/GMT zones use inverted signs: UTC-7 is "Etc/GMT+7".
    return offset === 0 ? 'Etc/GMT' : `Etc/GMT${offset < 0 ? '+' : '-'}${Math.abs(offset)}`;
  }
  return venueZone;
};

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

/** The zone's UTC offset (ms) at the given instant. */
const offsetMs = (instant: number, timeZone: string): number => {
  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    partsFormatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  const p = (type: string) => parts[type] ?? 0;
  const asUtc = Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
};

/** Converts a wall-clock time in a time zone to a UTC instant (ms). */
export const zonedTimeToUtc = (date: string, time: string, timeZone: string): number => {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const [hh = 0, mm = 0] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes so times near a DST change use the offset in effect at that moment.
  const first = wall - offsetMs(wall, timeZone);
  return wall - offsetMs(first, timeZone);
};

/** The event's start as a UTC instant, or null when its time or time zone is unknown. */
export const eventStartInstant = (e: EventItem): number | null => {
  if (!e.startTime || !e.timezone) return null;
  try {
    return zonedTimeToUtc(e.date, e.startTime, e.timezone);
  } catch {
    return null; // unsupported time zone in this runtime
  }
};

export interface EventTimeInfo {
  /** "10:00 AM EDT" — the listed time at the venue. */
  venue: string;
  /** "9:00 AM CDT" or "Fri 11:00 PM PDT" (weekday added when the date differs). */
  viewer: string;
  /** Whether the viewer's clock reads the same as the venue's. */
  same: boolean;
}

/** The listed time alongside the same moment in the viewer's time zone. */
export const describeEventTime = (e: EventItem, viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone): EventTimeInfo | null => {
  const instant = eventStartInstant(e);
  if (instant === null || !e.timezone || !e.startTime) return null;

  const venueZoneName = e.tzNote ?? zoneName(instant, e.timezone);
  const venue = `${formatTime(e.startTime)} ${venueZoneName}`;
  const same = offsetMs(instant, e.timezone) === offsetMs(instant, viewerZone);

  const viewerDate = new Intl.DateTimeFormat('en-CA', { timeZone: viewerZone }).format(instant);
  const viewer = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerZone,
    weekday: viewerDate === e.date ? undefined : 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(instant);

  return { venue, viewer, same };
};

const zoneName = (instant: number, timeZone: string): string => {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(instant).find((p) => p.type === 'timeZoneName')?.value ?? ''
  );
};

/** Tooltip text for an event's start time. */
export const eventTimeHint = (e: EventItem): string => {
  if (!e.startTime) return '';
  const info = describeEventTime(e);
  if (!info) return 'Venue time zone not listed';
  return info.same ? `${info.venue} (same as your time zone)` : `${info.venue} at the venue · ${info.viewer} your time`;
};
