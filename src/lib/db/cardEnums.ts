export const ATTRIBUTES = {
  1: 'LIGHT',
  2: 'DARK',
  3: 'WATER',
  4: 'FIRE',
  5: 'EARTH',
  6: 'WIND',
  7: 'DIVINE',
  8: 'SPELL',
  9: 'TRAP',
} as const;

export const SPELLTRAP_SUBTYPES = {
  0: 'Normal',
  1: 'Counter',
  2: 'Field',
  3: 'Equip',
  4: 'Continuous',
  5: 'Quick-Play',
  6: 'Ritual',
} as const;

export const CARD_TYPES = {
  1: 'Monster',
  2: 'Spell',
  3: 'Trap',
} as const;

export const LINK_ARROW_VALUES = {
  1: 'NW',
  2: 'N',
  3: 'NE',
  4: 'W',
  6: 'E',
  7: 'SW',
  9: 'SE',
} as const;

export type AttributeId = keyof typeof ATTRIBUTES;
export type SpelltrapSubtypeId = keyof typeof SPELLTRAP_SUBTYPES;
export type CardTypeId = keyof typeof CARD_TYPES;
export type LinkArrowValueId = keyof typeof LINK_ARROW_VALUES;

export const attributeName = (id: number): string | undefined => ATTRIBUTES[id as AttributeId];

export const spelltrapSubtypeName = (id: number): string | undefined => SPELLTRAP_SUBTYPES[id as SpelltrapSubtypeId];

export const cardTypeName = (id: number): string | undefined => CARD_TYPES[id as CardTypeId];
