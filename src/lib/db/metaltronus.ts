import { SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from './cardFilterRule';
import { isMonsterCard, valuesEqualForSmallWorld } from './smallWorld';

/** Frames Metaltronus never searches: spells and traps. Extra Deck monsters stay legal. */
export const METALTRONUS_EXCLUDED_FRAME_TYPE_IDS = [SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID] as const;

/** Properties Metaltronus compares between the target and a summon. */
export type MetaltronusProperty = 'type' | 'attribute' | 'atk';

export const METALTRONUS_PROPERTY_LABELS: Record<MetaltronusProperty, string> = {
  type: 'Type',
  attribute: 'Attribute',
  atk: 'ATK',
};

export type MetaltronusCard = {
  id: number;
  name: string;
  /** Monster type / race (`species_id`). */
  species_id: number | null;
  attribute_id: number | null;
  atk: number | null;
  frame_type_id?: number | null;
};

/** Printed token names in Neuron data: "Token" or names ending in " Token". */
export const isTokenMonsterName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.toLowerCase() === 'token' || / token$/i.test(trimmed);
};

export const isTokenFrameName = (name: string): boolean => /token/i.test(name);

export const isLegalMetaltronusMonster = (
  card: { name: string; frame_type_id?: number | null },
  tokenFrameTypeIds?: ReadonlySet<number>,
): boolean => {
  if (!isMonsterCard(card)) return false;
  if (isTokenMonsterName(card.name)) return false;
  if (card.frame_type_id != null && tokenFrameTypeIds?.has(card.frame_type_id)) return false;
  return true;
};

export const getMetaltronusSharedProperties = (a: MetaltronusCard, b: MetaltronusCard): MetaltronusProperty[] => {
  const shared: MetaltronusProperty[] = [];
  if (valuesEqualForSmallWorld(a.species_id, b.species_id)) shared.push('type');
  if (valuesEqualForSmallWorld(a.attribute_id, b.attribute_id)) shared.push('attribute');
  if (valuesEqualForSmallWorld(a.atk, b.atk)) shared.push('atk');
  return shared;
};

export const isMetaltronusMatch = (a: MetaltronusCard, b: MetaltronusCard): boolean =>
  getMetaltronusSharedProperties(a, b).length >= 2;

export type MetaltronusMatch<T extends MetaltronusCard = MetaltronusCard> = T & {
  shared: MetaltronusProperty[];
  sameName: boolean;
};

export const findMetaltronusMatches = <T extends MetaltronusCard>(target: MetaltronusCard, cards: T[]): MetaltronusMatch<T>[] =>
  cards
    .filter((c) => isLegalMetaltronusMonster(c) && isMetaltronusMatch(target, c))
    .map((c) => ({
      ...c,
      shared: getMetaltronusSharedProperties(target, c),
      sameName: c.name === target.name,
    }));
