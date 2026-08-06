import { getContext, setContext } from 'svelte';

export class YugiohArtwork {
  /** Must be `$state` so templates re-render when the remote manifest arrives. */
  manifest = $state<Manifest | undefined>(undefined);

  constructor() {
    $effect(() => {
      fetch('https://artworks.ygoresources.com/manifest.json')
        .then((res) => res.json())
        .then((d: Manifest) => {
          this.manifest = d;
        });
    });
  }

  getArtwork(cardId: number) {
    const manifest = this.manifest;
    if (!manifest) return null;
    const cardData = manifest.cards[String(cardId)];
    if (!cardData) return null;
    const artId = Object.keys(cardData)[0];
    if (!artId) return null;

    return cardData[artId] ?? null;
  }
}

const ARTWORKS_KEY = Symbol('ARTWORKS');
export const setArtworksState = () => setContext(ARTWORKS_KEY, new YugiohArtwork());
export const getArtworksState = () => getContext<YugiohArtwork>(ARTWORKS_KEY);

export interface Manifest {
  cards: Record<string, Record<string, Card>>;
}
export interface Card {
  bestArt: string;
  bestOCG: string;
  bestTCG?: string;
  idx: Idx;
}

export interface Idx {
  ae?: Language[];
  cn?: Language[];
  de?: Language[];
  en?: Language[];
  es?: Language[];
  fr?: Language[];
  it?: Language[];
  ja: Language[];
  ko?: Language[];
  pt?: Language[];
}

export interface Language {
  path: string;
  source: Source;
}

export enum Source {
  Database = 'database',
  NeuronHigh = 'neuron_high',
}
