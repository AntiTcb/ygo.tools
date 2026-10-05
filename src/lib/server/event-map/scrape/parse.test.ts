import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cityFromLine, parseDate, parseEventList, parsePage, parseTime, ParseError, shortYcsName } from './parse';
import { SOURCES, type EventListSource, type TablePressSource } from './sources';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const [regionalSource, otsSource] = SOURCES.filter((s): s is TablePressSource => s.kind === 'tablepress') as [TablePressSource, TablePressSource];
const ycsSource = SOURCES.find((s): s is EventListSource => s.kind === 'event-list')!;

describe('regionals page', () => {
  const { events, tables } = parsePage(fixture('regional-locations.html'), regionalSource);

  it('finds both format tables', () => {
    expect(tables.map((t) => t.format)).toEqual(['Advanced', 'Genesys']);
    expect(tables.every((t) => t.rows > 0)).toBe(true);
  });

  it('merges events listed in both format tables', () => {
    const philly = events.filter((e) => e.host === 'Alternate Universes' && e.date === '2027-01-09');
    expect(philly).toHaveLength(1);
    expect(philly[0]?.formats).toEqual(['Advanced', 'Genesys']);
    expect(events.length).toBeLessThan(tables.reduce((n, t) => n + t.rows, 0));
  });

  it('parses venue, time and contact details', () => {
    const e = events.find((e) => e.host === 'Arkham Games and Comics')!;
    expect(e).toMatchObject({
      type: 'regional',
      region: 'na',
      date: '2026-10-10',
      startTime: '10:00',
      tzNote: null,
      state: 'GA',
      country: 'United States',
      capacity: 300,
      email: 'arkhamgamesandcomics@gmail.com',
      phone: '(229) 515-3027',
      dragonDuel: true,
      isRemote: false,
    });
    expect(e.venue).toMatchObject({
      name: 'SRTC Student Wellness Center',
      address: '2500 East Shotwell Street, Bainbridge, GA 39819',
      city: 'Bainbridge',
    });
  });

  it('flags remote events and keeps their link', () => {
    const remote = events.find((e) => e.host === 'CoreTCG' && e.date === '2026-12-19')!;
    expect(remote.isRemote).toBe(true);
    expect(remote.venue).toBeNull();
    expect(remote.remoteUrl).toBe('https://discord.gg/coretcg');
    expect(remote.tzNote).toBe('PST');
  });

  it('normalizes Canadian country codes', () => {
    expect(events.some((e) => e.country === 'Canada')).toBe(true);
    expect(events.some((e) => e.country === 'CA')).toBe(false);
  });
});

describe('OTS championship page', () => {
  const { events, tables } = parsePage(fixture('otschamp-locations.html'), otsSource);

  it('splits North America and Latin America tables', () => {
    expect(tables.map((t) => t.region)).toEqual(['na', 'latam']);
    expect(events.filter((e) => e.region === 'na').length).toBeGreaterThan(300);
    expect(events.filter((e) => e.region === 'latam').length).toBeGreaterThan(200);
  });

  it('parses a North America store row', () => {
    const e = events.find((e) => e.host === 'Ktcollectible')!;
    expect(e).toMatchObject({
      type: 'ots',
      date: '2026-08-23',
      startTime: null,
      state: 'AK',
      country: 'United States',
      capacity: 70,
      formats: [],
    });
    expect(e.venue).toMatchObject({
      name: 'Ktcollectible',
      address: '751 East 36th Ave, Anchorage AK 99503',
      city: 'Anchorage',
    });
  });

  it('parses a Latin America row with separate city column', () => {
    const e = events.find((e) => e.host === 'Ludik, Legends and Lattes')!;
    expect(e.region).toBe('latam');
    expect(e.country).toBe('Argentina');
    expect(e.venue).toMatchObject({
      address: 'Garibaldi 108, Bahia Blanca, Buenos Aires',
      city: 'Bahia Blanca',
      state: 'Buenos Aires',
    });
  });

  it('gives every event a unique id', () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});

describe('YCS page', () => {
  const { events, tables } = parseEventList(fixture('ygo-championship-series.html'), ycsSource);
  const byHost = (host: string) => events.find((e) => e.host === host)!;

  it('reads every event from the JSON-LD and splits them by region', () => {
    expect(events).toHaveLength(6);
    expect(tables).toEqual([
      { tableId: 'json-ld:na', region: 'na', format: null, rows: 3 },
      { tableId: 'json-ld:latam', region: 'latam', format: null, rows: 3 },
    ]);
  });

  it('parses a multi-day US event with its venue', () => {
    expect(byHost('YCS Houston, Texas')).toMatchObject({
      type: 'ycs',
      region: 'na',
      date: '2026-10-16',
      endDate: '2026-10-18',
      startTime: null,
      state: 'TX',
      country: 'United States',
      isRemote: false,
      sourceUrl: 'https://www.yugioh-card.com/en/events-item/2026-ycs-houston/',
    });
    expect(byHost('YCS Houston, Texas').venue).toMatchObject({
      name: 'NRG Park',
      address: '1 Fannin St, Houston, TX 77054',
      city: 'Houston',
    });
  });

  it('keeps coordinates the page publishes, but not its placeholder', () => {
    expect(byHost('YCS Orlando, Florida').venue).toMatchObject({
      lat: 28.4248274,
      lng: -81.4694363,
    });
    expect(byHost('YCS Houston, Texas').venue?.lat).toBeUndefined();
  });

  it('places Latin American events by country and decodes venue names', () => {
    const e = byHost('YCS Guayaquil, Ecuador');
    expect(e).toMatchObject({ region: 'latam', country: 'Ecuador' });
    expect(e.venue?.name).toBe('Hotel Hilton Colón – Salón Gran Isabela I, II, III');
  });

  it('flags remote YCS events and assigns them by name', () => {
    const na = byHost('North America Remote Duel YCS');
    const latam = byHost('Latin America Remote Duel YCS');
    expect(na).toMatchObject({ isRemote: true, region: 'na', venue: null, endDate: '2026-12-06' });
    expect(latam).toMatchObject({ isRemote: true, region: 'latam', venue: null });
  });

  it('shortens names and requires the JSON-LD', () => {
    expect(shortYcsName('Yu-Gi-Oh! Championship Series Orlando, Florida 2026')).toBe('YCS Orlando, Florida');
    expect(() => parseEventList('<html></html>', ycsSource)).toThrow(ParseError);
    expect(parseEventList('<script type="application/ld+json">[]</script>', ycsSource).events).toEqual([]);
  });
});

describe('helpers', () => {
  it('parses dates and times', () => {
    expect(parseDate('8/23/2026')).toBe('2026-08-23');
    expect(parseDate('not a date')).toBeNull();
    expect(parseTime('10:00 AM MDT')).toEqual({ time: '10:00', tz: 'MDT' });
    expect(parseTime('12:30 PM')).toEqual({ time: '12:30', tz: null });
    expect(parseTime('12:15 AM')).toEqual({ time: '00:15', tz: null });
  });

  it('extracts cities from address lines', () => {
    expect(cityFromLine('Philadelphia, PA 19107')).toBe('Philadelphia');
    expect(cityFromLine('Saint-Hubert QC J3Y7E5')).toBe('Saint-Hubert');
    expect(cityFromLine('Verdun QC H4G 1W5')).toBe('Verdun');
  });

  it('throws when a table layout changes', () => {
    const html = `<table id="tablepress-otschamp_loc" class="tablepress"><thead><tr><th>Name</th></tr></thead></table>`;
    expect(() => parsePage(html, otsSource)).toThrow(ParseError);
  });
});
