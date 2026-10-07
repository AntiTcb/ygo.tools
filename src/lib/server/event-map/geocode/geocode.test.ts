import type { D1Database } from '@cloudflare/workers-types/index';
import { describe, expect, it } from 'vitest';
import { parseCensusResponse } from './census';
import { cleanAddressForSearch, pickNominatimResult, type NominatimPlace } from './nominatim';
import { geocodePendingVenues, type GeocodeConfig } from './pipeline';
import { normalizeName } from './shared';

describe('census', () => {
  it('parses matches and skips misses and ties', () => {
    const hits = parseCensusResponse(
      [
        '"a2","751 East 36th Ave, Anchorage AK 99503, , , ","Match","Exact","751 E 36TH AVE, ANCHORAGE, AK, 99503","-149.869444784199,61.188120307258","614833127","L"',
        '"a1","2500 East Shotwell Street, Bainbridge, GA 39819, , , ","No_Match"',
        '"a9","1 Main St, Somewhere, TX, ","Tie"',
      ].join('\n'),
    );
    expect([...hits]).toEqual([['a2', { lat: 61.188120307258, lng: -149.869444784199 }]]);
  });
});

describe('nominatim', () => {
  it('strips unit numbers OSM does not index', () => {
    expect(cleanAddressForSearch('Plaza Platino Blvd Acapulco 402 Local 34, Guadalupe, NL')).toBe('Plaza Platino Blvd Acapulco 402, Guadalupe, NL');
    expect(cleanAddressForSearch('3200 Kempt Rd., Suite 104, Halifax, NS B3K 4X1')).toBe('3200 Kempt Rd., Halifax, NS B3K 4X1');
    expect(cleanAddressForSearch('Yumbel 374 lt 3B, Linares, Maule')).toBe('Yumbel 374, Linares, Maule');
  });

  const place = (city: string, addresstype = 'road'): NominatimPlace => ({
    lat: '19.4',
    lon: '-99.1',
    addresstype,
    address: { city },
  });

  it('only accepts results in the venue city', () => {
    expect(pickNominatimResult([place('Puebla')], { city: 'Ciudad de México' })).toBeNull();
    expect(
      pickNominatimResult([place('Puebla'), place('Ciudad de Mexico')], {
        city: 'Ciudad De México',
      }),
    ).toEqual({ lat: 19.4, lng: -99.1 });
  });

  it('rejects results too coarse to pin a venue', () => {
    expect(pickNominatimResult([place('Bogotá', 'state')], { city: 'Bogota' })).toBeNull();
    expect(pickNominatimResult([place('x', 'country')], { city: null })).toBeNull();
  });

  it('normalizes names for comparison', () => {
    expect(normalizeName('São Paulo')).toBe('saopaulo');
    expect(normalizeName('Ciudad De México')).toBe(normalizeName('ciudad de mexico'));
  });
});

// --- Pipeline -----------------------------------------------------------------

interface FakeVenue {
  id: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string;
  mapbox_attempted: number;
}

/** Just enough of D1 for the pipeline: one SELECT, updates via batch, one COUNT. */
const fakeDb = (venues: FakeVenue[]) => {
  const writes: { sql: string; args: unknown[] }[] = [];
  const db = {
    prepare(sql: string) {
      const stmt = {
        sql,
        args: [] as unknown[],
        bind(...args: unknown[]) {
          return { ...stmt, args };
        },
        async all() {
          return { results: venues };
        },
        async first() {
          return { n: 0 };
        },
      };
      return stmt;
    },
    async batch(stmts: { sql: string; args: unknown[] }[]) {
      writes.push(...stmts.map(({ sql, args }) => ({ sql, args })));
      return [];
    },
  };
  const outcome = (id: string) => {
    const w = writes.find((x) => x.args.at(-1) === id);
    if (!w) return 'untouched';
    return w.sql.includes("'failed'") ? 'failed' : `ok:${w.args[2]}`;
  };
  return { db: db as unknown as D1Database, writes, outcome };
};

const venue = (id: string, country: string, extra: Partial<FakeVenue> = {}): FakeVenue => ({
  id,
  address: `${id} address`,
  city: null,
  state: null,
  country,
  mapbox_attempted: 0,
  ...extra,
});

interface Calls {
  census: number;
  nominatim: string[];
  mapbox: string[];
}

/** Routes provider requests to canned answers and records what was called. */
const fakeFetch = (answers: { census?: string[]; nominatim?: string[]; mapbox?: string[] }, calls: Calls) => {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname.includes('census.gov')) {
      calls.census++;
      const lines = (answers.census ?? []).map((id) => `"${id}","x","Match","Exact","x","-80.0,30.0","1","L"`);
      return new Response(lines.join('\n'));
    }
    if (url.hostname.includes('nominatim')) {
      const q = url.searchParams.get('q')!;
      calls.nominatim.push(q);
      const id = q.replace(' address', '');
      const body = answers.nominatim?.includes(id) ? [{ lat: '1', lon: '2', addresstype: 'road', address: {} }] : [];
      return Response.json(body);
    }
    if (url.hostname.includes('mapbox')) {
      const queries = JSON.parse(String(init?.body)) as { q: string }[];
      const ids = queries.map((x) => x.q.replace(' address', ''));
      calls.mapbox.push(...ids);
      return Response.json({
        batch: ids.map((id) =>
          answers.mapbox?.includes(id) ? { features: [{ properties: { coordinates: { latitude: 3, longitude: 4 } } }] } : { features: [] },
        ),
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
};

const baseConfig: Omit<GeocodeConfig, 'fetcher'> = {
  nominatimLimit: 10,
  mapboxFallback: true,
  mapboxToken: 'sk.test',
  sleep: () => Promise.resolve(),
};

describe('geocoding pipeline', () => {
  it('uses Census, then Nominatim, then Mapbox only for what is left', async () => {
    const { db, outcome } = fakeDb([
      venue('us1', 'United States'),
      venue('us2', 'United States'),
      venue('mx1', 'Mexico'),
      venue('mx2', 'Mexico'),
      venue('mx3', 'Mexico'),
    ]);
    const calls: Calls = { census: 0, nominatim: [], mapbox: [] };
    const fetcher = fakeFetch({ census: ['us1'], nominatim: ['us2', 'mx1'], mapbox: ['mx2'] }, calls);
    const summary = await geocodePendingVenues(db, { ...baseConfig, fetcher });

    expect(calls.census).toBe(1);
    expect(calls.nominatim.map((q) => q.split(' ')[0])).toEqual(['us2', 'mx1', 'mx2', 'mx3']);
    expect(calls.mapbox).toEqual(['mx2', 'mx3']);
    expect(summary.bySource).toEqual({ census: 1, nominatim: 2, mapbox: 1 });
    expect(summary.failed).toBe(1);
    expect(outcome('us1')).toBe('ok:census');
    expect(outcome('mx1')).toBe('ok:nominatim');
    expect(outcome('mx2')).toBe('ok:mapbox');
    expect(outcome('mx3')).toBe('failed');
  });

  it('never sends a venue to Mapbox twice', async () => {
    const { db, outcome } = fakeDb([venue('mx1', 'Mexico', { mapbox_attempted: 1 })]);
    const calls: Calls = { census: 0, nominatim: [], mapbox: [] };
    await geocodePendingVenues(db, { ...baseConfig, fetcher: fakeFetch({}, calls) });
    expect(calls.mapbox).toEqual([]);
    expect(outcome('mx1')).toBe('failed');
  });

  it('leaves venues beyond the Nominatim budget pending, without Mapbox', async () => {
    const { db, outcome } = fakeDb([venue('mx1', 'Mexico'), venue('mx2', 'Mexico')]);
    const calls: Calls = { census: 0, nominatim: [], mapbox: [] };
    await geocodePendingVenues(db, {
      ...baseConfig,
      nominatimLimit: 1,
      fetcher: fakeFetch({}, calls),
    });
    expect(calls.mapbox).toEqual(['mx1']);
    expect(outcome('mx1')).toBe('failed');
    expect(outcome('mx2')).toBe('untouched');
  });

  it('marks venues failed after the free providers when Mapbox is disabled', async () => {
    const { db, outcome } = fakeDb([venue('mx1', 'Mexico')]);
    const calls: Calls = { census: 0, nominatim: [], mapbox: [] };
    await geocodePendingVenues(db, {
      ...baseConfig,
      mapboxFallback: false,
      fetcher: fakeFetch({}, calls),
    });
    expect(calls.mapbox).toEqual([]);
    expect(outcome('mx1')).toBe('failed');
  });
});
