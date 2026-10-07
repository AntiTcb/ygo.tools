/**
 * "Add to calendar" support: Google/Outlook links and iCalendar (.ics) output.
 *
 * Timed events whose time zone is known are exported as UTC instants, so they
 * land at the right moment in any calendar. When the zone is unknown (e.g. a
 * remote event with no zone listed) they fall back to *floating* times (no
 * TZID / Z suffix), which calendars show at the listed hour in the viewer's zone.
 */
import { addDays, formatTime } from './dates';
import { eventStartInstant } from './event-time';
import { EVENT_TYPE_LABELS, type EventItem } from './types';

/** Assumed length of timed events; the source pages only list a start time. */
const DEFAULT_DURATION_HOURS = 8;

export const eventTitle = (e: EventItem): string => {
  const formats = e.formats.length ? ` (${e.formats.join(' / ')})` : '';
  return `Yu-Gi-Oh! ${EVENT_TYPE_LABELS[e.type]}${formats} – ${e.host}`;
};

export const eventLocation = (e: EventItem): string => {
  if (e.isRemote) return e.remoteUrl ?? 'Online (remote duel)';
  if (!e.venue) return '';
  const parts = [e.venue.name, e.venue.address, e.country];
  return parts.filter(Boolean).join(', ');
};

export const eventDescription = (e: EventItem): string => {
  const lines = [e.type === 'ycs' ? `${e.host} (Yu-Gi-Oh! Championship Series).` : `${EVENT_TYPE_LABELS[e.type]} hosted by ${e.host}.`];
  if (e.startTime) {
    lines.push(`Starts ${formatTime(e.startTime)}${e.tzNote ? ` ${e.tzNote}` : ''} (venue local time).`);
  }
  if (e.formats.length) lines.push(`Formats: ${e.formats.join(', ')}`);
  if (e.capacity) lines.push(`Capacity: ${e.capacity}`);
  if (e.email || e.phone) lines.push(`Contact: ${[e.email, e.phone].filter(Boolean).join(' / ')}`);
  if (e.remoteUrl) lines.push(`Online: ${e.remoteUrl}`);
  lines.push(`Details: ${e.sourceUrl}`);
  return lines.join('\n');
};

interface Span {
  allDay: boolean;
  /** Timed span expressed in UTC (true) or as floating local time (false). */
  utc: boolean;
  /** YYYY-MM-DD */
  startDate: string;
  /** HH:MM:SS, timed events only */
  startTime?: string;
  /** Exclusive end date for all-day events; end date for timed events. */
  endDate: string;
  endTime?: string;
}

export const eventSpan = (e: EventItem): Span => {
  if (!e.startTime) {
    // All-day end dates are exclusive, so a Fri–Sun event ends on Monday.
    return {
      allDay: true,
      utc: false,
      startDate: e.date,
      endDate: addDays(e.endDate ?? e.date, 1),
    };
  }

  const instant = eventStartInstant(e);
  if (instant !== null) {
    const [startDate = '', startTime = ''] = new Date(instant).toISOString().slice(0, 19).split('T');
    const end = new Date(instant + DEFAULT_DURATION_HOURS * 3_600_000).toISOString();
    const [endDate = '', endTime = ''] = end.slice(0, 19).split('T');
    return { allDay: false, utc: true, startDate, startTime, endDate, endTime };
  }

  const [h = 0, m = 0] = e.startTime.split(':').map(Number);
  const endMinutes = h * 60 + m + DEFAULT_DURATION_HOURS * 60;
  const endDate = endMinutes >= 1440 ? addDays(e.date, 1) : e.date;
  const em = endMinutes % 1440;
  return {
    allDay: false,
    utc: false,
    startDate: e.date,
    startTime: `${e.startTime}:00`,
    endDate,
    endTime: `${String(Math.floor(em / 60)).padStart(2, '0')}:${String(em % 60).padStart(2, '0')}:00`,
  };
};

const compact = (date: string, time?: string, utc = false) =>
  date.replaceAll('-', '') + (time ? `T${time.replaceAll(':', '')}${utc ? 'Z' : ''}` : '');

export const googleCalendarUrl = (e: EventItem): string => {
  const s = eventSpan(e);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', eventTitle(e));
  url.searchParams.set('dates', `${compact(s.startDate, s.startTime, s.utc)}/${compact(s.endDate, s.endTime, s.utc)}`);
  url.searchParams.set('details', eventDescription(e));
  url.searchParams.set('location', eventLocation(e));
  return url.toString();
};

export const outlookCalendarUrl = (e: EventItem, service: 'live' | 'office' = 'live'): string => {
  const s = eventSpan(e);
  const host = service === 'live' ? 'outlook.live.com' : 'outlook.office.com';
  const url = new URL(`https://${host}/calendar/0/action/compose`);
  url.searchParams.set('rru', 'addevent');
  url.searchParams.set('subject', eventTitle(e));
  url.searchParams.set('body', eventDescription(e));
  url.searchParams.set('location', eventLocation(e));
  if (s.allDay) {
    url.searchParams.set('allday', 'true');
    url.searchParams.set('startdt', s.startDate);
    url.searchParams.set('enddt', s.endDate);
  } else {
    const z = s.utc ? 'Z' : '';
    url.searchParams.set('startdt', `${s.startDate}T${s.startTime}${z}`);
    url.searchParams.set('enddt', `${s.endDate}T${s.endTime}${z}`);
  }
  return url.toString();
};

const escapeText = (s: string): string => {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
};

/** Folds content lines to 75 octets as required by RFC 5545. */
const fold = (line: string): string => {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (size + n > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
};

export interface IcsOptions {
  name: string;
  /** Page the calendar was generated from, added as the calendar's URL. */
  url?: string;
  /** Hint for subscribed calendars to re-fetch, in hours. */
  refreshHours?: number;
}

export const buildIcs = (events: EventItem[], opts: IcsOptions): string => {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ygo-event-map//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
  ];
  if (opts.url) lines.push(`URL:${opts.url}`);
  if (opts.refreshHours) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshHours}H`);
    lines.push(`X-PUBLISHED-TTL:PT${opts.refreshHours}H`);
  }

  for (const e of events) {
    const s = eventSpan(e);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@ygo-event-map`,
      `DTSTAMP:${stamp}`,
      s.allDay ? `DTSTART;VALUE=DATE:${compact(s.startDate)}` : `DTSTART:${compact(s.startDate, s.startTime, s.utc)}`,
      s.allDay ? `DTEND;VALUE=DATE:${compact(s.endDate)}` : `DTEND:${compact(s.endDate, s.endTime, s.utc)}`,
      `SUMMARY:${escapeText(eventTitle(e))}`,
      `DESCRIPTION:${escapeText(eventDescription(e))}`,
      `LOCATION:${escapeText(eventLocation(e))}`,
      `URL:${e.sourceUrl}`,
    );
    if (e.venue?.lat != null && e.venue.lng != null) {
      lines.push(`GEO:${e.venue.lat};${e.venue.lng}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
};
