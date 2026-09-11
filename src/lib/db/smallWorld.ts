import { SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from './cardFilterRule';

/**
 * Extra Deck `neuron_cards.frame_type_id` values (Fusion / Synchro / Xyz / Link
 * and their combo frames). Ritual and main-deck Pendulum frames stay searchable.
 */
export const EXTRA_DECK_COMPLEX_FRAME_TYPE_IDS = [2, 3, 17, 18, 19, 22, 23, 34, 35, 39, 41, 42, 43, 47] as const;

/** Frames Small World must never search: spells, traps, and Extra Deck monsters. */
export const SMALL_WORLD_EXCLUDED_FRAME_TYPE_IDS = [
  SPELL_FRAME_TYPE_ID,
  TRAP_FRAME_TYPE_ID,
  ...EXTRA_DECK_COMPLEX_FRAME_TYPE_IDS,
] as const;

const SMALL_WORLD_EXCLUDED_FRAME_TYPE_ID_SET = new Set<number>(SMALL_WORLD_EXCLUDED_FRAME_TYPE_IDS);

/** Properties Small World compares between monsters. */
export type SmallWorldProperty = 'type' | 'attribute' | 'level' | 'atk' | 'def';

export const SMALL_WORLD_PROPERTY_LABELS: Record<SmallWorldProperty, string> = {
  type: 'Type',
  attribute: 'Attribute',
  level: 'Level',
  atk: 'ATK',
  def: 'DEF',
};

export type SmallWorldCard = {
  id: number;
  name: string;
  /** Monster type / race (`species_id`). */
  species_id: number | null;
  attribute_id: number | null;
  level: number | null;
  atk: number | null;
  def: number | null;
  frame_type_id?: number | null;
};

/** Null never bridges — Links without Level/DEF do not share those stats. */
export const valuesEqualForSmallWorld = (a: number | null, b: number | null): boolean => {
  if (a === null || b === null) return false;
  return a === b;
};

export const isMonsterCard = (card: { frame_type_id?: number | null }): boolean => {
  const frame = card.frame_type_id;
  if (frame === SPELL_FRAME_TYPE_ID || frame === TRAP_FRAME_TYPE_ID) return false;
  return true;
};

/** Main Deck monsters only — Extra Deck Fusion/Synchro/Xyz/Link frames are illegal Small World hits. */
export const isMainDeckMonster = (card: { frame_type_id?: number | null }): boolean => {
  const frame = card.frame_type_id;
  if (frame == null) return isMonsterCard(card);
  return !SMALL_WORLD_EXCLUDED_FRAME_TYPE_ID_SET.has(frame);
};

export const getSharedProperties = (a: SmallWorldCard, b: SmallWorldCard): SmallWorldProperty[] => {
  const shared: SmallWorldProperty[] = [];
  if (valuesEqualForSmallWorld(a.species_id, b.species_id)) shared.push('type');
  if (valuesEqualForSmallWorld(a.attribute_id, b.attribute_id)) shared.push('attribute');
  if (valuesEqualForSmallWorld(a.level, b.level)) shared.push('level');
  if (valuesEqualForSmallWorld(a.atk, b.atk)) shared.push('atk');
  if (valuesEqualForSmallWorld(a.def, b.def)) shared.push('def');
  return shared;
};

export const isExactOneBridge = (a: SmallWorldCard, b: SmallWorldCard): boolean => getSharedProperties(a, b).length === 1;

export const findExactBridges = <T extends SmallWorldCard>(from: SmallWorldCard, cards: T[]): T[] =>
  cards.filter((c) => c.id !== from.id && isExactOneBridge(from, c));

export type SmallWorldTarget<T extends SmallWorldCard = SmallWorldCard> = T & {
  shared: SmallWorldProperty[];
};

export const findExactTargets = <T extends SmallWorldCard>(
  bridge: SmallWorldCard,
  cards: T[],
  options?: { excludeIds?: Iterable<number> },
): SmallWorldTarget<T>[] => {
  const exclude = new Set(options?.excludeIds ?? []);
  exclude.add(bridge.id);
  return cards.filter((c) => !exclude.has(c.id) && isExactOneBridge(bridge, c)).map((c) => ({ ...c, shared: getSharedProperties(bridge, c) }));
};
