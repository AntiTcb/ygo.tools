import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardFilterRow } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow } from '../db/cardFilterRule';
import type { Database, Json } from '../db/database.types';
import { TAGGABLE_CARD_COLUMNS, type TaggableCardRow } from './cardText';
import type { PromptVocab } from './prompt';
import { buildNameIndex, makeNameResolver, projectTagOutput, type NameIndex } from './store';
import type { TagOutput, Target, Vocab } from './tagSchema';

export type Db = SupabaseClient<Database>;

const PAGE = 1000;

/** Pages through a PostgREST query sequentially (bursts of parallel requests get throttled upstream). */
export const fetchAll = async <T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> => {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
};

export const loadVocab = async (db: Db): Promise<{ prompt: PromptVocab; vocab: Vocab }> => {
  const [verbs, zones] = await Promise.all([
    db.from('effect_vocab_verbs').select('term,description,usable_as_action,usable_as_event').is('retired_at', null).order('id'),
    db.from('effect_vocab_zones').select('term,description').is('retired_at', null).order('id'),
  ]);
  if (verbs.error) throw new Error(verbs.error.message);
  if (zones.error) throw new Error(zones.error.message);
  return {
    prompt: { verbs: verbs.data, zones: zones.data },
    vocab: {
      actionVerbs: verbs.data.filter((v) => v.usable_as_action).map((v) => v.term),
      eventVerbs: verbs.data.filter((v) => v.usable_as_event).map((v) => v.term),
      zones: zones.data.map((z) => z.term),
    },
  };
};

export const loadComplexFrames = async (db: Db): Promise<{ rows: ComplexFrameTypeRow[]; names: Map<number, string> }> => {
  const { data, error } = await db.from('neuron_complex_frame_types').select('id,name,subtype_1,subtype_2,subtype_3').eq('language', 'en');
  if (error) throw new Error(error.message);
  return { rows: data, names: new Map(data.map((r) => [r.id, r.name])) };
};

export type PoolCard = TaggableCardRow & CardFilterRow;

export type CardPool = {
  cards: PoolCard[];
  byId: Map<number, PoolCard>;
  names: NameIndex;
  complexRows: ComplexFrameTypeRow[];
  frameNames: Map<number, string>;
};

/** Every English card with its archetypes: the universe for name resolution and target comparison. */
export const loadCardPool = async (db: Db): Promise<CardPool> => {
  const rows = await fetchAll((from, to) =>
    db.from('neuron_cards').select(`${TAGGABLE_CARD_COLUMNS},pend_scale_l,pend_scale_r,link_arrows`).eq('language', 'en').order('id').range(from, to),
  );
  const memberships = await fetchAll((from, to) =>
    db.from('card_archetypes').select('card_id,archetype').order('card_id').order('archetype').range(from, to),
  );
  const archetypes = new Map<number, string[]>();
  for (const m of memberships) archetypes.set(m.card_id, [...new Set([...(archetypes.get(m.card_id) ?? []), m.archetype])]);
  const frames = await loadComplexFrames(db);
  const cards: PoolCard[] = rows.map((r) => ({ ...r, archetypes: archetypes.get(r.id) ?? [] }));
  return { cards, byId: new Map(cards.map((c) => [c.id, c])), names: buildNameIndex(cards), complexRows: frames.rows, frameNames: frames.names };
};

const targetNames = (t: Target | null): string[] =>
  t ? [...(t.names ?? []), ...(t.exclude_names ?? []), ...(t.any_of ?? []).flatMap((l) => [...(l.names ?? []), ...(l.exclude_names ?? [])])] : [];

/** Every quoted card name a tagger output refers to. */
export const referencedNames = (out: TagOutput): string[] => [
  ...new Set(
    out.effects.flatMap((e) => [
      ...e.actions.flatMap((a) => [...a.name_refs, ...targetNames(a.target)]),
      ...e.triggers.flatMap((t) => [...targetNames(t.subject), ...targetNames(t.cause_card)]),
    ]),
  ),
];

/** A name index over just the cards `out` mentions (for one-off stores, e.g. /admin corrections). */
export const loadNameIndexFor = async (db: Db, out: TagOutput): Promise<NameIndex> => {
  const cards: { id: number; name: string }[] = [];
  for (const name of referencedNames(out)) {
    // ilike without wildcards = case-insensitive equality; the second pattern catches renamed cards.
    const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
    for (const pattern of [escaped, `${escaped} (Updated from:%`]) {
      const { data, error } = await db.from('neuron_cards').select('id,name').eq('language', 'en').ilike('name', pattern);
      if (error) throw new Error(error.message);
      cards.push(...data);
    }
  }
  return buildNameIndex(cards);
};

/** Konami's related cards for one card (for disambiguating quoted names). */
export const loadRelatedIds = async (db: Db, cardId: number): Promise<Set<number>> => {
  const { data, error } = await db.from('neuron_card_relations').select('relation_card_id').eq('card_id', cardId);
  if (error) throw new Error(error.message);
  return new Set(data.map((r) => r.relation_card_id));
};

export type StoreArgs = {
  cardId: number;
  /** md5 of the tagged text (from effect_tag_queue); omit to use the card's current text. */
  textHash?: string;
  output: TagOutput;
  names: NameIndex;
  relatedIds?: Set<number>;
  model: string | null;
  promptVersion: string | null;
  mode: 'tagger' | 'manual';
};

/** Writes a card's tags (and the tagger's vocabulary suggestions). Returns 'stored' or 'drafted' (locked card). */
export const storeCardTags = async (db: Db, a: StoreArgs): Promise<'stored' | 'drafted'> => {
  const rows = projectTagOutput(a.output, makeNameResolver(a.names, a.relatedIds));
  const { data, error } = await db.rpc('effect_store_card_tags', {
    p_card_id: a.cardId,
    p_text_hash: a.textHash,
    p_output: a.output as unknown as Json,
    p_rows: rows as unknown as Json,
    p_model: a.model ?? '',
    p_prompt_version: a.promptVersion ?? '',
    p_mode: a.mode,
  });
  if (error) throw new Error(`store card ${a.cardId}: ${error.message}`);
  if (a.mode === 'tagger' && a.output.unmapped.length) {
    const res = await db.rpc('effect_record_suggestions', { p_card_id: a.cardId, p_items: a.output.unmapped as unknown as Json });
    if (res.error) throw new Error(`record suggestions for ${a.cardId}: ${res.error.message}`);
  }
  return data as 'stored' | 'drafted';
};
