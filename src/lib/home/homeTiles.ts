/** YGOResources card IDs used by the artwork manifest (`neuron_cards.id`). */
export const SMALL_WORLD_CARD_ID = 16555;
export const METALTRONUS_CARD_ID = 19910;
export const GIZMEK_UKA_CARD_ID = 15017;

export type HomeTile = {
  href: string;
  title: string;
  description: string;
};

export type HomeHelperTile = HomeTile & {
  cardId: number;
  cardName: string;
};

export const sortTilesByTitle = <T extends { title: string }>(tiles: readonly T[]): T[] =>
  [...tiles].sort((a, b) => a.title.localeCompare(b.title));

export const HOME_TOOL_TILES = sortTilesByTitle([
  {
    href: '/damagecalc',
    title: 'Damage Calculation Calculator',
    description: 'A calculator for the various effects that modify how battle damage is applied to players during Damage Calculation.',
  },
  {
    href: '/database',
    title: 'Card Database',
    description: 'A card database with advanced search capabilities.',
  },
] as const satisfies readonly HomeTile[]);

export const HOME_HELPER_TILES = sortTilesByTitle([
  {
    href: '/smallworld',
    title: 'Small World Helper',
    description: 'Find exact one-property bridges and add targets for Small World.',
    cardId: SMALL_WORLD_CARD_ID,
    cardName: 'Small World',
  },
  {
    href: '/metaltronus',
    title: 'Metaltronus Helper',
    description: 'Find legal Metaltronus partners that share two of Type, Attribute, and/or ATK — as summons or as targets.',
    cardId: METALTRONUS_CARD_ID,
    cardName: 'Metaltronus',
  },
  {
    href: '/gizmekuka',
    title: 'Gizmek Uka Helper',
    description: 'Find Main Deck ATK=DEF summons that share an Attribute with an opponent’s monster — or the reverse, every same-Attribute target.',
    cardId: GIZMEK_UKA_CARD_ID,
    cardName: 'Gizmek Uka',
  },
] as const satisfies readonly HomeHelperTile[]);
