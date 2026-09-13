import { NEURON_ATK_DEF_QUESTION_MARK, SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from './cardFilterRule';
import { isLegalMetaltronusMonster } from './metaltronus';
import { isMainDeckMonster, valuesEqualForSmallWorld } from './smallWorld';

/** Frames Gizmek Uka never searches: spells and traps. Extra Deck stays in the target pool. */
export const GIZMEK_UKA_EXCLUDED_FRAME_TYPE_IDS = [SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID] as const;

export type GizmekUkaCard = {
  id: number;
  name: string;
  attribute_id: number | null;
  atk: number | null;
  def: number | null;
  frame_type_id?: number | null;
};

/** Any non-Token monster, including Extra Deck — legal as an opponent's face-up target. */
export const isLegalGizmekUkaMonster = isLegalMetaltronusMonster;

/**
 * Printed ATK equals printed DEF. Null and `?` (-1) never count — those values
 * are not a known ATK/DEF pair for "whose ATK equals its own DEF".
 */
export const isAtkEqualToOwnDef = (card: { atk: number | null; def: number | null }): boolean => {
  if (card.atk === NEURON_ATK_DEF_QUESTION_MARK || card.def === NEURON_ATK_DEF_QUESTION_MARK) return false;
  return valuesEqualForSmallWorld(card.atk, card.def);
};

/** Hand/Deck summons: Main Deck, non-Token, ATK equals own DEF. */
export const isLegalGizmekUkaSummon = (
  card: { name: string; atk: number | null; def: number | null; frame_type_id?: number | null },
  tokenFrameTypeIds?: ReadonlySet<number>,
): boolean => isLegalGizmekUkaMonster(card, tokenFrameTypeIds) && isMainDeckMonster(card) && isAtkEqualToOwnDef(card);

export const sharesAttribute = (a: { attribute_id: number | null }, b: { attribute_id: number | null }): boolean =>
  valuesEqualForSmallWorld(a.attribute_id, b.attribute_id);

/** Forward: opponent's monster → Main Deck ATK=DEF summons of the same Attribute. */
export const findGizmekUkaSummons = <T extends GizmekUkaCard>(opponentMonster: GizmekUkaCard, cards: T[]): T[] =>
  cards.filter((c) => isLegalGizmekUkaSummon(c) && sharesAttribute(c, opponentMonster));

/** Reverse: ATK=DEF Main Deck summon → every non-Token monster sharing its Attribute. */
export const findGizmekUkaTargets = <T extends GizmekUkaCard>(summon: GizmekUkaCard, cards: T[]): T[] => {
  if (!isLegalGizmekUkaSummon(summon)) return [];
  return cards.filter((c) => isLegalGizmekUkaMonster(c) && sharesAttribute(c, summon));
};
