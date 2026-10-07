import { describe, expect, it } from 'vitest';
import { buildIcs, eventSpan, googleCalendarUrl, outlookCalendarUrl } from './calendar-links';
import { formatDateRange, formatTime, formatWeekend, nextWeekend, overlapsRange, weekendOf } from './dates';
import { applyFilters, DEFAULT_RADIUS, effectiveRadius, filtersToParams, parseFilters } from './filters';
import { areaOf } from './map-areas';
import { describeEventTime, eventTimeZone, zonedTimeToUtc } from './event-time';
import type { EventItem } from './types';

const event = (overrides: Partial<EventItem> = {}): EventItem => {
  return {
    id: 'abc123',
    type: 'regional',
    region: 'na',
    host: 'Arkham Games, and Comics',
    date: '2026-10-10',
    endDate: null,
    startTime: '10:00',
    tzNote: null,
    timezone: null,
    formats: ['Advanced', 'Genesys'],
    isRemote: false,
    remoteUrl: null,
    venue: {
      name: 'SRTC Student Wellness Center',
      address: '2500 East Shotwell Street, Bainbridge, GA 39819',
      city: 'Bainbridge',
      lat: 30.9,
      lng: -84.57,
    },
    state: 'GA',
    country: 'United States',
    capacity: 300,
    email: 'a@example.com',
    phone: null,
    dragonDuel: true,
    vendorInfo: null,
    sourceUrl: 'https://www.yugioh-card.com/en/events/regional-locations/',
    ...overrides,
  };
};

describe('dates', () => {
  it('groups Friday–Sunday into a weekend keyed by Saturday', () => {
    expect(weekendOf('2026-10-09')).toBe('2026-10-10'); // Fri
    expect(weekendOf('2026-10-10')).toBe('2026-10-10'); // Sat
    expect(weekendOf('2026-10-11')).toBe('2026-10-10'); // Sun
    expect(weekendOf('2026-10-07')).toBeNull(); // Wed
    expect(nextWeekend('2026-10-05')).toBe('2026-10-10'); // Mon
    expect(formatWeekend('2026-10-31')).toMatch(/Oct 30\s*–\s*Nov 1/);
  });

  it('formats times', () => {
    expect(formatTime('10:00')).toBe('10:00 AM');
    expect(formatTime('13:05')).toBe('1:05 PM');
    expect(formatTime('00:30')).toBe('12:30 AM');
  });
});

describe('filters', () => {
  it('round-trips through URL params', () => {
    const params = new URLSearchParams('type=ots&format=Genesys&weekend=2026-10-10&state=GA&radius=100&past=1');
    const f = parseFilters(params);
    expect(f).toEqual({
      types: ['ots'],
      formats: ['Genesys'],
      weekend: '2026-10-10',
      state: 'GA',
      radius: 100,
      past: true,
    });
    expect(filtersToParams(f).toString()).toBe(params.toString());
  });

  it('filters by weekend, state, past and radius', () => {
    const events = [
      event({ id: 'a' }),
      event({ id: 'b', date: '2026-10-14' }),
      event({ id: 'c', state: 'FL' }),
      event({ id: 'd', date: '2026-09-01' }),
      event({ id: 'e', venue: { ...event().venue!, lat: 47.6, lng: -122.3 } }),
      event({ id: 'f', isRemote: true, venue: null }),
    ];
    const f = parseFilters(new URLSearchParams('weekend=2026-10-10&state=GA&radius=50'));
    const ids = applyFilters(events, f, {
      origin: { lat: 30.8, lng: -84.6 },
      unit: 'mi',
      today: '2026-10-05',
    }).map((e) => e.id);
    expect(ids).toEqual(['a', 'f']);

    const upcoming = applyFilters(events, parseFilters(new URLSearchParams()), {
      unit: 'mi',
      today: '2026-10-05',
    });
    expect(upcoming.map((e) => e.id)).not.toContain('d');
  });

  it('defaults to a radius once a starting point is set, unless "any" is chosen', () => {
    const near = event({ id: 'near' });
    const far = event({ id: 'far', venue: { ...event().venue!, lat: 47.6, lng: -122.3 } });
    const ctx = { origin: { lat: 30.8, lng: -84.6 }, unit: 'mi' as const, today: '2026-10-05' };

    const defaults = parseFilters(new URLSearchParams());
    expect(effectiveRadius(defaults, true, 'mi')).toBe(DEFAULT_RADIUS.mi);
    expect(effectiveRadius(defaults, false, 'mi')).toBeNull();
    expect(applyFilters([near, far], defaults, ctx).map((e) => e.id)).toEqual(['near']);

    const any = parseFilters(new URLSearchParams('radius=any'));
    expect(any.radius).toBe('any');
    expect(filtersToParams(any).toString()).toBe('radius=any');
    expect(effectiveRadius(any, true, 'mi')).toBeNull();
    expect(applyFilters([near, far], any, ctx).map((e) => e.id)).toEqual(['near', 'far']);
  });
});

describe('calendar links', () => {
  it('builds timed and all-day spans', () => {
    expect(eventSpan(event())).toMatchObject({
      allDay: false,
      startTime: '10:00:00',
      endDate: '2026-10-10',
      endTime: '18:00:00',
    });
    expect(eventSpan(event({ startTime: null }))).toEqual({
      allDay: true,
      utc: false,
      startDate: '2026-10-10',
      endDate: '2026-10-11',
    });
  });

  it('builds Google and Outlook links', () => {
    const g = new URL(googleCalendarUrl(event()));
    expect(g.searchParams.get('dates')).toBe('20261010T100000/20261010T180000');
    const o = new URL(outlookCalendarUrl(event({ startTime: null })));
    expect(o.searchParams.get('allday')).toBe('true');
    expect(o.searchParams.get('enddt')).toBe('2026-10-11');
  });

  it('builds valid, escaped and folded ICS', () => {
    const ics = buildIcs([event(), event({ id: 'x', startTime: null })], { name: 'Test' });
    expect(ics).toContain('DTSTART:20261010T100000');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261010');
    expect(ics).toContain('Arkham Games\\, and Comics');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

describe('map areas', () => {
  it('puts far-flung US states in insets and everything else on the main map', () => {
    expect(areaOf(event({ state: 'AK' }), 'na')).toBe('alaska');
    expect(areaOf(event({ state: 'HI' }), 'na')).toBe('hawaii');
    expect(areaOf(event({ state: 'PR' }), 'na')).toBe('caribbean');
    expect(areaOf(event({ state: 'GU' }), 'na')).toBe('pacific');
    expect(areaOf(event({ state: 'GA' }), 'na')).toBe('main');
    expect(areaOf(event({ state: 'BC' }), 'na')).toBe('main');
    expect(areaOf(event({ state: 'Buenos Aires' }), 'latam')).toBe('main');
  });
});

describe('event time zones', () => {
  it('maps listed abbreviations to fixed offsets and falls back to the venue zone', () => {
    expect(eventTimeZone('MST', 'America/Phoenix')).toBe('Etc/GMT+7');
    expect(eventTimeZone('EDT', null)).toBe('Etc/GMT+4');
    expect(eventTimeZone(null, 'America/Chicago')).toBe('America/Chicago');
    expect(eventTimeZone(null, null)).toBeNull();
  });

  it('converts venue wall-clock times to UTC across DST', () => {
    const iso = (ms: number) => new Date(ms).toISOString();
    expect(iso(zonedTimeToUtc('2026-10-10', '10:00', 'America/New_York'))).toBe('2026-10-10T14:00:00.000Z');
    // US DST ends 2026-11-01, so New York is UTC-5 the following weekend.
    expect(iso(zonedTimeToUtc('2026-11-07', '10:00', 'America/New_York'))).toBe('2026-11-07T15:00:00.000Z');
    expect(iso(zonedTimeToUtc('2026-12-19', '10:00', 'Etc/GMT+8'))).toBe('2026-12-19T18:00:00.000Z');
  });

  it("describes the start in the viewer's time zone", () => {
    const e = event({ timezone: 'America/New_York' });
    expect(describeEventTime(e, 'America/Chicago')).toEqual({
      venue: '10:00 AM EDT',
      viewer: '9:00 AM CDT',
      same: false,
    });
    expect(describeEventTime(e, 'America/New_York')?.same).toBe(true);
    expect(describeEventTime(event({ timezone: null }), 'America/Chicago')).toBeNull();
    // Listed abbreviations are kept as written.
    const remote = event({ tzNote: 'PST', timezone: 'Etc/GMT+8', date: '2026-12-19' });
    expect(describeEventTime(remote, 'America/New_York')).toMatchObject({
      venue: '10:00 AM PST',
      viewer: '1:00 PM EST',
    });
  });

  it('exports known-zone events as UTC', () => {
    const e = event({ timezone: 'America/New_York' });
    expect(new URL(googleCalendarUrl(e)).searchParams.get('dates')).toBe('20261010T140000Z/20261010T220000Z');
    expect(buildIcs([e], { name: 'x' })).toContain('DTSTART:20261010T140000Z');
    expect(new URL(outlookCalendarUrl(e)).searchParams.get('startdt')).toBe('2026-10-10T14:00:00Z');
  });
});

describe('multi-day events', () => {
  const ycs = event({ type: 'ycs', date: '2026-10-30', endDate: '2026-11-01', startTime: null });

  it('overlaps every range it touches', () => {
    expect(overlapsRange(ycs, '2026-10-01', '2026-11-01')).toBe(true);
    expect(overlapsRange(ycs, '2026-11-01', '2026-12-01')).toBe(true);
    expect(overlapsRange(ycs, '2026-11-02', '2026-12-01')).toBe(false);
    expect(formatDateRange(ycs.date, ycs.endDate)).toMatch(/Fri, Oct 30\s*–\s*Sun, Nov 1, 2026/);
  });

  it('stays upcoming until its last day and exports the full span', () => {
    const f = parseFilters(new URLSearchParams());
    expect(applyFilters([ycs], f, { unit: 'mi', today: '2026-11-01' })).toHaveLength(1);
    expect(applyFilters([ycs], f, { unit: 'mi', today: '2026-11-02' })).toHaveLength(0);
    expect(eventSpan(ycs)).toMatchObject({
      allDay: true,
      startDate: '2026-10-30',
      endDate: '2026-11-02',
    });
  });
});
