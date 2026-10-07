import type { EventItem, Region } from './types';

/** [[west, south], [east, north]] */
export type Bounds = [[number, number], [number, number]];

export interface MapArea {
  id: string;
  label: string;
  /** The view shown when nothing is selected or filtered. */
  bounds: Bounds;
  /** State/territory codes that belong in this area (insets only). */
  states?: string[];
}

/**
 * Each region has a main map plus optional insets. Far-flung US states and
 * territories get their own small maps (like a classic US map) so the main
 * map never has to zoom out to the whole hemisphere to include them.
 */
export const MAP_AREAS: Record<Region, { main: MapArea; insets: MapArea[] }> = {
  na: {
    main: {
      id: 'main',
      label: 'Continental US',
      bounds: [
        [-124.8, 24.4],
        [-66.9, 49.4],
      ],
    },
    insets: [
      {
        id: 'alaska',
        label: 'Alaska',
        states: ['AK'],
        bounds: [
          [-170, 52],
          [-130, 71.5],
        ],
      },
      {
        id: 'hawaii',
        label: 'Hawaii',
        states: ['HI'],
        bounds: [
          [-160.3, 18.9],
          [-154.8, 22.3],
        ],
      },
      {
        id: 'caribbean',
        label: 'Puerto Rico & USVI',
        states: ['PR', 'VI'],
        bounds: [
          [-67.3, 17.6],
          [-64.5, 18.6],
        ],
      },
      {
        id: 'pacific',
        label: 'Guam & N. Mariana Is.',
        states: ['GU', 'MP'],
        bounds: [
          [144.55, 13.2],
          [145.9, 15.3],
        ],
      },
    ],
  },
  latam: {
    main: {
      id: 'main',
      label: 'Latin America',
      bounds: [
        [-118, -56],
        [-34, 33],
      ],
    },
    insets: [],
  },
};

/** Which map area an event's pin belongs to. */
export const areaOf = (event: EventItem, region: Region): string => {
  const inset = MAP_AREAS[region].insets.find((a) => event.state && a.states?.includes(event.state));
  return inset?.id ?? 'main';
};
