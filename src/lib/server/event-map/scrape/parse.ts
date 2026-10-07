import { parse, type HTMLElement } from 'node-html-parser';
import type { EventType, Region } from '#lib/event-map/types.js';
import type { EventListSource, TablePressSource } from './sources';

export interface ScrapedVenue {
  id: string;
  name: string | null;
  /** Street address lines joined with ", " (plus city/state when listed separately). */
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  /** Coordinates published by the source page itself, when it has them. */
  lat?: number;
  lng?: number;
}

export interface ScrapedEvent {
  id: string;
  type: EventType;
  region: Region;
  host: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  tzNote: string | null;
  formats: string[];
  venue: ScrapedVenue | null;
  isRemote: boolean;
  remoteUrl: string | null;
  state: string | null;
  country: string;
  capacity: number | null;
  email: string | null;
  phone: string | null;
  dragonDuel: boolean | null;
  vendorInfo: string | null;
  sourceUrl: string;
}

export interface ParsedTable {
  tableId: string;
  region: Region;
  format: string | null;
  rows: number;
}

export interface ParsedPage {
  events: ScrapedEvent[];
  tables: ParsedTable[];
}

type Column = 'host' | 'date' | 'address' | 'city' | 'state' | 'country' | 'capacity' | 'contact' | 'dragonDuel' | 'vendor';

/** Header text patterns, checked in order; the first match wins for each header cell. */
const HEADER_PATTERNS: [Column, RegExp][] = [
  ['host', /event host|ots name|store name/i],
  ['date', /^date/i],
  ['address', /address/i],
  ['city', /^city$/i],
  ['state', /state/i],
  ['country', /country/i],
  ['capacity', /capacity/i],
  ['contact', /contact/i],
  ['dragonDuel', /dragon duel/i],
  ['vendor', /vendor/i],
];

const REQUIRED_COLUMNS: Column[] = ['host', 'date', 'address', 'country'];

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  USA: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
};

export class ParseError extends Error {}

export const parsePage = (html: string, source: TablePressSource): ParsedPage => {
  const root = parse(html);
  const tables: ParsedTable[] = [];
  const byId = new Map<string, ScrapedEvent>();

  for (const table of root.querySelectorAll('table.tablepress')) {
    const tableId = (table.id ?? '').replace(/^tablepress-/, '');
    const info = source.classify(tableId);
    if (!info) continue;

    const columns = mapColumns(table, tableId);
    const hasVenueName = /venue name/i.test(headerText(table, columns.address));
    let rows = 0;

    for (const tr of table.querySelectorAll('tbody tr')) {
      const cells = tr.querySelectorAll('td');
      const event = parseRow(cells, columns, {
        type: source.type,
        region: info.region,
        format: info.format,
        hasVenueName,
        sourceUrl: source.url,
      });
      if (!event) continue;
      rows++;

      // Regionals are listed once per format table; merge them into one event.
      const existing = byId.get(event.id);
      if (existing) {
        for (const f of event.formats) {
          if (!existing.formats.includes(f)) existing.formats.push(f);
        }
      } else {
        byId.set(event.id, event);
      }
    }

    tables.push({ tableId, region: info.region, format: info.format, rows });
  }

  return { events: [...byId.values()], tables };
};

const mapColumns = (table: HTMLElement, tableId: string): Partial<Record<Column, number>> => {
  const columns: Partial<Record<Column, number>> = {};
  table.querySelectorAll('thead th').forEach((th, i) => {
    const text = clean(th.text);
    const match = HEADER_PATTERNS.find(([col, re]) => columns[col] === undefined && re.test(text));
    if (match) columns[match[0]] = i;
  });
  const missing = REQUIRED_COLUMNS.filter((c) => columns[c] === undefined);
  if (missing.length) {
    throw new ParseError(`Table ${tableId} is missing columns: ${missing.join(', ')}`);
  }
  return columns;
};

const headerText = (table: HTMLElement, index: number | undefined): string => {
  if (index === undefined) return '';
  return clean(table.querySelectorAll('thead th')[index]?.text ?? '');
};

interface RowContext {
  type: EventType;
  region: Region;
  format: string | null;
  hasVenueName: boolean;
  sourceUrl: string;
}

const parseRow = (cells: HTMLElement[], columns: Partial<Record<Column, number>>, ctx: RowContext): ScrapedEvent | null => {
  const cell = (col: Column) => (columns[col] === undefined ? undefined : cells[columns[col]]);
  const lines = (col: Column) => cellLines(cell(col));
  const text = (col: Column) => lines(col).join(' ') || null;

  const host = text('host');
  const dateLines = lines('date');
  const parsedDate = dateLines[0] ? parseDate(dateLines[0]) : null;
  if (!host || !parsedDate) return null;
  const time = parseTime(dateLines.slice(1).join(' '));

  const country = normalizeCountry(text('country') ?? '');
  const state = text('state');
  const addressCell = cell('address');
  const addressLines = lines('address');
  const links = addressCell?.querySelectorAll('a').map((a) => a.getAttribute('href') ?? '') ?? [];
  const isRemote = addressLines.some((l) => /remote duel/i.test(l)) || links.some((l) => /discord/i.test(l));

  let venue: ScrapedVenue | null = null;
  if (!isRemote && addressLines.length) {
    const name = ctx.hasVenueName ? (addressLines[0] ?? null) : host;
    const street = ctx.hasVenueName ? addressLines.slice(1) : addressLines;
    const cityCol = text('city');
    const city = cityCol ?? cityFromLine(street.at(-1) ?? '');
    const parts = cityCol ? [...street, cityCol, state ?? ''] : street;
    const address = parts.filter(Boolean).join(', ');
    venue = {
      id: hash(`${address}|${country}`.toLowerCase().replace(/[^a-z0-9|]+/g, '')),
      name,
      address,
      city,
      state,
      country,
    };
  }

  const contact = lines('contact');
  const email =
    cell('contact')
      ?.querySelectorAll('a[href^="mailto:"]')
      .map((a) => (a.getAttribute('href') ?? '').replace(/^mailto:/i, '').trim())[0] ??
    contact.find((l) => l.includes('@')) ??
    null;
  const phone = contact.filter((l) => !l.includes('@')).join(' / ') || null;

  const capacity = Number.parseInt((text('capacity') ?? '').replace(/[^\d]/g, ''), 10);
  const dragonDuel = text('dragonDuel');
  const remoteUrl = isRemote ? (links.find((l) => /^https?:/i.test(l)) ?? null) : null;

  return {
    id: hash([ctx.type, host, parsedDate, venue?.id ?? remoteUrl ?? 'remote'].join('|').toLowerCase()),
    type: ctx.type,
    region: ctx.region,
    host,
    date: parsedDate,
    endDate: null,
    startTime: time?.time ?? null,
    tzNote: time?.tz ?? null,
    formats: ctx.format ? [ctx.format] : [],
    venue,
    isRemote,
    remoteUrl,
    state,
    country,
    capacity: Number.isFinite(capacity) ? capacity : null,
    email,
    phone,
    dragonDuel: dragonDuel === null ? null : /^yes/i.test(dragonDuel),
    vendorInfo: lines('vendor').join('; ') || null,
    sourceUrl: ctx.sourceUrl,
  };
};

/** Splits a cell on <br> into trimmed, entity-decoded, non-empty lines. */
const cellLines = (cell: HTMLElement | undefined): string[] => {
  if (!cell) return [];
  return cell.innerHTML
    .split(/<br\s*\/?>/i)
    .map((part) => clean(parse(part).text))
    .filter(Boolean);
};

const clean = (s: string): string => {
  return s.replace(/\s+/g, ' ').trim();
};

/** "1/09/2027" -> "2027-01-09". */
export const parseDate = (s: string): string | null => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, month = '', day = '', year = ''] = m;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/** "10:00 AM MST" -> { time: "10:00", tz: "MST" }. */
export const parseTime = (s: string): { time: string; tz: string | null } | null => {
  const m = /(\d{1,2}):(\d{2})\s*([AP]M)\s*([A-Z]{2,4})?/i.exec(s);
  if (!m) return null;
  const [, hh = '0', mm = '00', meridiem = 'AM', tz] = m;
  let hour = Number(hh) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;
  return { time: `${String(hour).padStart(2, '0')}:${mm}`, tz: tz?.toUpperCase() ?? null };
};

/** "Philadelphia, PA 19107" or "Anchorage AK 99503" -> the city. */
export const cityFromLine = (line: string): string | null => {
  const city = line
    .replace(/,?\s+[A-Z]{2}\s+[A-Z0-9][A-Z0-9 -]{2,9}$/i, '')
    .replace(/,\s*$/, '')
    .trim();
  return city && city !== line.trim() ? city : null;
};

export const normalizeCountry = (s: string): string => {
  return COUNTRY_NAMES[s.toUpperCase()] ?? s;
};

/** cyrb53: a fast, stable 53-bit string hash, used for ids. Not cryptographic. */
export const hash = (str: string): string => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

// --- Event-list pages (YCS) -------------------------------------------------

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI GU MP AS'.split(
    ' ',
  ),
);
const CA_PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const NORTH_AMERICA = new Set(['United States', 'Canada']);

interface JsonLdEvent {
  '@type'?: string;
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  location?: {
    name?: string;
    geo?: { latitude?: number | string; longitude?: number | string };
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
}

/** "Yu-Gi-Oh! Championship Series Houston, Texas 2026" -> "YCS Houston, Texas". */
export const shortYcsName = (name: string): string => {
  return clean(name.replace(/Yu-Gi-Oh!\s+Championship Series/i, 'YCS').replace(/\s+\d{4}$/, ''));
};

/**
 * Parses a page that lists events with The Events Calendar plugin, using the
 * schema.org Event JSON-LD it embeds. An empty list is valid (no upcoming
 * events); a page with no JSON-LD at all means the layout changed.
 */
export const parseEventList = (html: string, source: EventListSource): ParsedPage => {
  const root = parse(html);
  const blocks = root.querySelectorAll('script[type="application/ld+json"]');
  if (!blocks.length) throw new ParseError(`No event JSON-LD found on ${source.url}`);

  const items: JsonLdEvent[] = blocks.flatMap((b) => {
    try {
      const data = JSON.parse(b.text) as JsonLdEvent | JsonLdEvent[];
      return Array.isArray(data) ? data : [data];
    } catch {
      return [];
    }
  });

  const events = items.filter((it) => it['@type'] === 'Event' && it.name && it.startDate).map((it) => toEvent(it, source));
  const counts = { na: 0, latam: 0 };
  for (const e of events) counts[e.region]++;

  return {
    events,
    tables: (['na', 'latam'] as const).map((region) => ({
      tableId: `json-ld:${region}`,
      region,
      format: null,
      rows: counts[region],
    })),
  };
};

const toEvent = (it: JsonLdEvent, source: EventListSource): ScrapedEvent => {
  const name = decode(it.name!);
  const sourceUrl = new URL(it.url ?? source.url, source.url).toString();
  const place = it.location ?? {};
  const a = place.address ?? {};
  const placeName = place.name ? decode(place.name) : null;
  const isRemote = /discord|remote duel/i.test(`${placeName ?? ''} ${name}`) && !a.streetAddress;

  const state = a.addressRegion ? clean(a.addressRegion) : null;
  const country = a.addressCountry
    ? normalizeCountry(clean(a.addressCountry))
    : state && US_STATES.has(state)
      ? 'United States'
      : state && CA_PROVINCES.has(state)
        ? 'Canada'
        : isRemote && /latin america/i.test(name)
          ? 'Latin America'
          : 'United States';
  const region: Region = isRemote ? (/latin america/i.test(name) ? 'latam' : 'na') : NORTH_AMERICA.has(country) ? 'na' : 'latam';

  let venue: ScrapedVenue | null = null;
  if (!isRemote && a.streetAddress) {
    const cityLine = [a.addressLocality, [state, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const address = [decode(a.streetAddress), cityLine].filter(Boolean).join(', ');
    venue = {
      id: hash(`${address}|${country}`.toLowerCase().replace(/[^a-z0-9|]+/g, '')),
      name: placeName,
      address,
      city: a.addressLocality ? decode(a.addressLocality) : null,
      state,
      country,
      ...sourceCoordinates(place.geo),
    };
  }

  // Dates are local midnight-to-midnight in the site's zone; only the day matters.
  const date = it.startDate!.slice(0, 10);
  const end = it.endDate?.slice(0, 10) ?? null;

  return {
    id: hash(`${source.type}|${sourceUrl}`.toLowerCase()),
    type: source.type,
    region,
    host: shortYcsName(name),
    date,
    endDate: end && end > date ? end : null,
    startTime: null,
    tzNote: null,
    formats: [],
    venue,
    isRemote,
    remoteUrl: null,
    state,
    country,
    capacity: null,
    email: null,
    phone: null,
    dragonDuel: null,
    vendorInfo: null,
    sourceUrl,
  };
};

/** The plugin's placeholder for venues without real coordinates (the US centroid). */
const PLACEHOLDER_GEO = { lat: 37.09024, lng: -95.712891 };

/** Usable coordinates from a JSON-LD GeoCoordinates object, if any. */
const sourceCoordinates = (geo: { latitude?: number | string; longitude?: number | string } | undefined) => {
  const lat = Number(geo?.latitude);
  const lng = Number(geo?.longitude);
  if (!geo || !Number.isFinite(lat) || !Number.isFinite(lng)) return {};
  if (lat === PLACEHOLDER_GEO.lat && lng === PLACEHOLDER_GEO.lng) return {};
  return { lat, lng };
};

const decode = (s: string): string => {
  return clean(parse(s).text);
};
