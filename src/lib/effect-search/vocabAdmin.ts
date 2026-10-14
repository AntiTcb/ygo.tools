import { fetchAll, type Db } from './db';
import { cardsMatchingPhrases, requestRetag } from './runner';

/**
 * /admin vocabulary operations. Each one that changes what cards should say marks just the affected
 * cards for re-tagging (picked up by the next tagging run); locked cards get a draft instead.
 */

export type VocabKind = 'verb' | 'zone';

const TERM = /^[a-z][a-z0-9_]*$/;

const table = (kind: VocabKind) => (kind === 'verb' ? 'effect_vocab_verbs' : 'effect_vocab_zones');

type SuggestionRow = { id: number; kind: VocabKind; phrases: string[]; example_card_ids: number[] };

const loadSuggestions = async (db: Db, ids: number[]): Promise<SuggestionRow[]> => {
  const { data, error } = await db.from('effect_vocab_suggestions').select('id,kind,phrases,example_card_ids').in('id', ids);
  if (error) throw new Error(error.message);
  return data;
};

/** Example cards of the suggestions, plus other cards whose text contains one of their phrases. */
const affectedCards = async (db: Db, suggestions: SuggestionRow[]): Promise<number[]> => {
  const examples = suggestions.flatMap((s) => s.example_card_ids);
  const byPhrase = await cardsMatchingPhrases(db, [...new Set(suggestions.flatMap((s) => s.phrases))]);
  return [...new Set([...examples, ...byPhrase])];
};

const setStatus = async (db: Db, ids: number[], patch: Record<string, unknown>) => {
  const { error } = await db
    .from('effect_vocab_suggestions')
    .update({ ...patch, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
};

export type ApproveInput = { kind: VocabKind; term: string; description: string; usableAsAction: boolean; usableAsEvent: boolean };

/** Adds a new term for these suggestions (one cluster) and re-tags the cards they came from. */
export const approveSuggestions = async (db: Db, ids: number[], input: ApproveInput): Promise<{ retagged: number }> => {
  if (!TERM.test(input.term)) throw new Error('Terms are snake_case: lowercase letters, digits and underscores');
  if (!input.description.trim()) throw new Error('A description is required (the tagger reads it)');
  const suggestions = await loadSuggestions(db, ids);
  if (suggestions.some((s) => s.kind !== input.kind)) throw new Error(`Some of these suggestions aren't ${input.kind}s`);

  if (input.kind === 'verb') {
    if (!input.usableAsAction && !input.usableAsEvent) throw new Error('A verb must be usable as an action, an event, or both');
    const { error } = await db.from('effect_vocab_verbs').insert({
      term: input.term,
      description: input.description.trim(),
      usable_as_action: input.usableAsAction,
      usable_as_event: input.usableAsEvent,
    });
    if (error) throw new Error(error.code === '23505' ? `"${input.term}" already exists: merge into it instead` : error.message);
  } else {
    const { error } = await db.from('effect_vocab_zones').insert({ term: input.term, description: input.description.trim() });
    if (error) throw new Error(error.code === '23505' ? `"${input.term}" already exists: merge into it instead` : error.message);
  }
  await setStatus(db, ids, { status: 'approved' });
  return { retagged: await requestRetag(db, await affectedCards(db, suggestions), `new ${input.kind}: ${input.term}`) };
};

/** These suggestions mean an existing term; re-tag their cards so they use it. */
export const mergeSuggestions = async (db: Db, ids: number[], kind: VocabKind, termId: number): Promise<{ retagged: number }> => {
  const suggestions = await loadSuggestions(db, ids);
  if (suggestions.some((s) => s.kind !== kind)) throw new Error(`Some of these suggestions aren't ${kind}s`);
  const { data: term, error } = await db.from(table(kind)).select('term').eq('id', termId).is('retired_at', null).single();
  if (error) throw new Error(error.message);
  await setStatus(db, ids, { status: 'merged', ...(kind === 'verb' ? { merged_into_verb_id: termId } : { merged_into_zone_id: termId }) });
  return { retagged: await requestRetag(db, await affectedCards(db, suggestions), `merged into ${kind}: ${term.term}`) };
};

export const rejectSuggestions = async (db: Db, ids: number[]) => setStatus(db, ids, { status: 'rejected' });

/** Renaming keeps the id, so stored tags follow it; prompts pick up the new name on the next run. */
export const renameTerm = async (db: Db, kind: VocabKind, id: number, term: string) => {
  if (!TERM.test(term)) throw new Error('Terms are snake_case: lowercase letters, digits and underscores');
  const { error } = await db.from(table(kind)).update({ term, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.code === '23505' ? `"${term}" already exists` : error.message);
};

export const updateTerm = async (
  db: Db,
  kind: VocabKind,
  id: number,
  patch: { description: string; usableAsAction?: boolean; usableAsEvent?: boolean },
) => {
  if (!patch.description.trim()) throw new Error('A description is required (the tagger reads it)');
  const base = { description: patch.description.trim(), updated_at: new Date().toISOString() };
  if (kind === 'verb') {
    if (!patch.usableAsAction && !patch.usableAsEvent) throw new Error('A verb must be usable as an action, an event, or both');
    const { error } = await db
      .from('effect_vocab_verbs')
      .update({ ...base, usable_as_action: Boolean(patch.usableAsAction), usable_as_event: Boolean(patch.usableAsEvent) })
      .eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from('effect_vocab_zones').update(base).eq('id', id);
    if (error) throw new Error(error.message);
  }
};

/** Retires a term in favour of another and re-tags every card that uses it (locked ones get drafts). */
export const retireTerm = async (db: Db, kind: VocabKind, id: number, replacementId: number): Promise<{ retagged: number }> => {
  if (id === replacementId) throw new Error('Pick a different replacement');
  const { data: terms, error } = await db.from(table(kind)).select('id,term,retired_at').in('id', [id, replacementId]);
  if (error) throw new Error(error.message);
  const old = terms.find((t) => t.id === id);
  const replacement = terms.find((t) => t.id === replacementId);
  if (!old || !replacement) throw new Error('Unknown term');
  if (replacement.retired_at) throw new Error(`"${replacement.term}" is retired itself`);

  const now = new Date().toISOString();
  const upd = await db.from(table(kind)).update({ retired_at: now, replaced_by: replacementId, updated_at: now }).eq('id', id);
  if (upd.error) throw new Error(upd.error.message);

  // Busy terms are used thousands of times: page past PostgREST's row cap.
  const lists =
    kind === 'verb'
      ? [
          await fetchAll((f, t) => db.from('effect_actions').select('card_id').eq('verb_id', id).order('id').range(f, t)),
          await fetchAll((f, t) => db.from('effect_triggers').select('card_id').eq('event_verb_id', id).order('id').range(f, t)),
        ]
      : [
          await fetchAll((f, t) => db.from('effect_actions').select('card_id').contains('from_zones', [id]).order('id').range(f, t)),
          await fetchAll((f, t) => db.from('effect_actions').select('card_id').contains('to_zones', [id]).order('id').range(f, t)),
          await fetchAll((f, t) => db.from('effect_triggers').select('card_id').contains('from_zones', [id]).order('id').range(f, t)),
        ];
  const cards = [...new Set(lists.flat().map((r) => r.card_id))];
  return { retagged: await requestRetag(db, cards, `retired ${kind}: ${old.term} -> ${replacement.term}`) };
};
