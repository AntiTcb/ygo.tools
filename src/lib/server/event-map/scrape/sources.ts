import type { EventType, Region } from '#lib/event-map/types.js';

export const REGIONALS_URL = 'https://www.yugioh-card.com/en/events/regional-locations/';
export const OTS_URL = 'https://www.yugioh-card.com/en/events/otschampionship/otschamp_locations/';
export const YCS_URL = 'https://www.yugioh-card.com/en/events/ygo-championship-series/';

export interface TableInfo {
  region: Region;
  /** Tournament format the table lists, e.g. "Advanced". Null when the page doesn't split by format. */
  format: string | null;
}

/** A page listing events in TablePress tables (Regionals, OTS Championships). */
export interface TablePressSource {
  kind: 'tablepress';
  url: string;
  type: EventType;
  /**
   * Classifies a TablePress table by its id (without the `tablepress-` prefix).
   * Returns null for tables that aren't event listings. Table ids embed the
   * season code (e.g. `reg_na_betb_adv`), so match on patterns, not exact ids.
   */
  classify(tableId: string): TableInfo | null;
}

/**
 * A page listing events with The Events Calendar plugin (YCS). Its schema.org
 * Event JSON-LD carries names, dates and venue addresses for every event.
 */
export interface EventListSource {
  kind: 'event-list';
  url: string;
  type: EventType;
}

export type PageSource = TablePressSource | EventListSource;

const REGIONAL_FORMATS: Record<string, string> = { adv: 'Advanced', gen: 'Genesys' };

export const SOURCES: PageSource[] = [
  {
    kind: 'tablepress',
    url: REGIONALS_URL,
    type: 'regional',
    classify(tableId) {
      const m = /^reg_(na|latam)_.*_([a-z]+)$/.exec(tableId);
      if (!m) return null;
      const [, region, code = ''] = m;
      return {
        region: region as Region,
        format: REGIONAL_FORMATS[code] ?? code.toUpperCase(),
      };
    },
  },
  {
    kind: 'tablepress',
    url: OTS_URL,
    type: 'ots',
    classify(tableId) {
      if (!tableId.startsWith('otschamp')) return null;
      return { region: tableId.includes('latam') ? 'latam' : 'na', format: null };
    },
  },
  { kind: 'event-list', url: YCS_URL, type: 'ycs' },
];
