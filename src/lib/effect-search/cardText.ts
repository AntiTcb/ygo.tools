import { attributeName, SPELLTRAP_SUBTYPES, type SpelltrapSubtypeId } from '../db/cardEnums';
import { SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from '../db/cardFilterRule';
import { formatAtkDef } from '../db/cardStatDisplay';
import type { TaggerCard } from './prompt';
import { RACE_IDS } from './tagSchema';

const RACE_BY_ID = new Map<number, string>(Object.entries(RACE_IDS).map(([name, id]) => [id, name]));

/** The `neuron_cards` columns the tagger needs. */
export type TaggableCardRow = {
  id: number;
  name: string;
  effect_text: string | null;
  pendulum_text: string | null;
  frame_type_id: number | null;
  effect_id: number | null;
  attribute_id: number | null;
  species_id: number | null;
  level: number | null;
  link_rating: number | null;
  atk: number | null;
  def: number | null;
};

export const TAGGABLE_CARD_COLUMNS = 'id,name,effect_text,pendulum_text,frame_type_id,effect_id,attribute_id,species_id,level,link_rating,atk,def';

/**
 * "Xyz/Effect Monster · Rank 2 · WATER · Aqua · ATK 2200 / DEF 0", "Quick-Play Spell".
 * `frameNames` maps `neuron_complex_frame_types` ids to names ("Xyz／Effect").
 */
export const cardTypeLine = (row: TaggableCardRow, frameNames: ReadonlyMap<number, string>): string => {
  if (row.frame_type_id === SPELL_FRAME_TYPE_ID || row.frame_type_id === TRAP_FRAME_TYPE_ID) {
    const sub = SPELLTRAP_SUBTYPES[(row.effect_id ?? 0) as SpelltrapSubtypeId] ?? 'Normal';
    return `${sub} ${row.frame_type_id === SPELL_FRAME_TYPE_ID ? 'Spell' : 'Trap'}`;
  }
  const frame = (row.frame_type_id !== null ? frameNames.get(row.frame_type_id) : undefined)?.replaceAll('／', '/') ?? 'Monster';
  const parts = [`${frame} Monster`];
  if (row.link_rating) parts.push(`Link-${row.link_rating}`);
  else if (row.level !== null) parts.push(`${frame.includes('Xyz') ? 'Rank' : 'Level'} ${row.level}`);
  const attr = row.attribute_id !== null ? attributeName(row.attribute_id) : undefined;
  if (attr) parts.push(attr);
  const race = row.species_id !== null ? RACE_BY_ID.get(row.species_id) : undefined;
  if (race) parts.push(race);
  parts.push(row.link_rating ? `ATK ${formatAtkDef(row.atk)}` : `ATK ${formatAtkDef(row.atk)} / DEF ${formatAtkDef(row.def)}`);
  return parts.join(' · ');
};

export const toTaggerCard = (row: TaggableCardRow, frameNames: ReadonlyMap<number, string>): TaggerCard => ({
  name: row.name.replace(/\s*\(Updated from: .*\)$/, ''),
  typeLine: cardTypeLine(row, frameNames),
  effectText: row.effect_text,
  pendulumText: row.pendulum_text,
});
