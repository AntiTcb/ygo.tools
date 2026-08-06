import { NEURON_ATK_DEF_QUESTION_MARK } from './cardFilterRule';
import { attributeName } from './cardEnums';

export const formatAtkDef = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  if (n === NEURON_ATK_DEF_QUESTION_MARK) return '?';
  return String(n);
};

/** Prefer Link rating; otherwise Level/Rank from `level` (shared column in Neuron data). */
export const formatLevelRankLink = (card: {
  level: number | null;
  link_rating: number | null;
  frameName?: string | null;
}): string | null => {
  if (card.link_rating != null && card.link_rating > 0) return `LINK-${card.link_rating}`;
  if (card.level == null) return null;
  const frame = card.frameName?.toLowerCase() ?? '';
  const label = frame.includes('xyz') ? 'Rank' : 'Level';
  return `${label} ${card.level}`;
};

export const formatPendScale = (l: number | null | undefined, r: number | null | undefined): string | null => {
  if (l == null && r == null) return null;
  return `Scale ${l ?? '—'}/${r ?? '—'}`;
};

export type CardStatLine = {
  attribute: string | null;
  typeLine: string | null;
  levelLine: string | null;
  scaleLine: string | null;
  atkDef: string;
};

export const buildCardStatLine = (
  card: {
    atk: number | null;
    def: number | null;
    level: number | null;
    link_rating: number | null;
    attribute_id: number | null;
    species_id: number | null;
    frame_type_id: number | null;
    pend_scale_l: number | null;
    pend_scale_r: number | null;
  },
  lookups: {
    speciesById: Map<number, string>;
    frameById: Map<number, string>;
  },
): CardStatLine => {
  const frameName = card.frame_type_id != null ? (lookups.frameById.get(card.frame_type_id) ?? null) : null;
  const species = card.species_id != null ? (lookups.speciesById.get(card.species_id) ?? null) : null;
  const attr = card.attribute_id != null ? (attributeName(card.attribute_id) ?? null) : null;

  const typeParts = [species, frameName].filter(Boolean);
  return {
    attribute: attr,
    typeLine: typeParts.length ? typeParts.join(' · ') : null,
    levelLine: formatLevelRankLink({ level: card.level, link_rating: card.link_rating, frameName }),
    scaleLine: formatPendScale(card.pend_scale_l, card.pend_scale_r),
    atkDef: `${formatAtkDef(card.atk)} / ${formatAtkDef(card.def)}`,
  };
};
