import type { Json } from '$lib/db/database.types';
import { toTaggerCard, TAGGABLE_CARD_COLUMNS } from '$lib/effect-search/cardText';
import { loadComplexFrames, loadNameIndexFor, loadRelatedIds, loadVocab, storeCardTags, type Db } from '$lib/effect-search/db';
import { exactTargetComparer, scoreCard } from '$lib/effect-search/evalScore';
import { tagOutputSchema, validateTagOutput, type TagOutput } from '$lib/effect-search/tagSchema';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const cardId = (raw: string) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(404, 'Not found');
  return id;
};

const loadCard = async (db: Db, id: number) => {
  const { data, error: e } = await db.from('neuron_cards').select(TAGGABLE_CARD_COLUMNS).eq('language', 'en').eq('id', id).maybeSingle();
  if (e) error(500, e.message);
  if (!data) error(404, 'No English card with that id');
  return data;
};

/** Parses a TagOutput from a form field; returns errors in the shape the editor shows. */
const parseOutputField = async (db: Db, raw: FormDataEntryValue | null): Promise<{ output: TagOutput } | { errors: string[] }> => {
  let json: unknown;
  try {
    json = JSON.parse(String(raw ?? ''));
  } catch (e) {
    return { errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  const parsed = tagOutputSchema.safeParse(json);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  const { vocab } = await loadVocab(db);
  const problems = validateTagOutput(parsed.data, vocab);
  return problems.length ? { errors: problems } : { output: parsed.data };
};

export const load: PageServerLoad = async ({ locals, params }) => {
  const db = locals.supabase;
  const id = cardId(params.id);
  const [card, frames, tags, gold, queued, archetypes, unresolved] = await Promise.all([
    loadCard(db, id),
    loadComplexFrames(db),
    db.from('effect_card_tags').select('output,locked,source,pending_draft,model,prompt_version,tagged_at').eq('card_id', id).maybeSingle(),
    db.from('effect_gold_cards').select('expected,notes,updated_at').eq('card_id', id).maybeSingle(),
    db.from('effect_tag_queue').select('card_id').eq('card_id', id).maybeSingle(),
    db.from('card_archetypes').select('archetype,source').eq('card_id', id).order('archetype'),
    db.from('effect_actions').select('unresolved_name_refs').eq('card_id', id),
  ]);
  for (const r of [tags, gold, queued, archetypes, unresolved]) if (r.error) error(500, r.error.message);

  const output = tags.data?.output ? tagOutputSchema.parse(tags.data.output) : null;
  const draft = tags.data?.pending_draft ? tagOutputSchema.parse(tags.data.pending_draft) : null;
  const goldOutput = gold.data ? tagOutputSchema.parse(gold.data.expected) : null;
  // Structural comparison only: loading the whole card pool for target-set comparison is too heavy per request.
  const goldScore = output && goldOutput ? scoreCard(goldOutput, output, exactTargetComparer) : null;

  return {
    card: { id: card.id, name: card.name, ...toTaggerCard(card, frames.names) },
    tags: tags.data ? { ...tags.data, output, pending_draft: draft } : null,
    /** Card text changed since tagging (or never tagged). */
    stale: queued.data !== null,
    gold: gold.data ? { notes: gold.data.notes, updated_at: gold.data.updated_at, expected: goldOutput } : null,
    goldScore: goldScore && { score: goldScore.score, notes: goldScore.notes },
    archetypes: archetypes.data ?? [],
    unresolvedNames: [...new Set((unresolved.data ?? []).flatMap((a) => a.unresolved_name_refs))],
  };
};

export const actions: Actions = {
  /** Hand correction: replaces the tags and locks the card against automatic re-tagging. */
  save: async ({ locals, params, request }) => {
    const db = locals.supabase;
    const id = cardId(params.id);
    const form = await request.formData();
    const res = await parseOutputField(db, form.get('output'));
    if ('errors' in res) return fail(400, { errors: res.errors, output: String(form.get('output') ?? '') });
    await storeCardTags(db, {
      cardId: id,
      output: res.output,
      names: await loadNameIndexFor(db, res.output),
      relatedIds: await loadRelatedIds(db, id),
      model: null,
      promptVersion: null,
      mode: 'manual',
    });
    return { saved: true };
  },

  /** Lets automatic re-tagging replace this card's tags again. */
  unlock: async ({ locals, params }) => {
    const { error: e } = await locals.supabase.from('effect_card_tags').update({ locked: false }).eq('card_id', cardId(params.id));
    if (e) return fail(500, { errors: [e.message] });
    return { unlocked: true };
  },

  /** Errata on a locked card: take the tagger's draft as the new (still locked) tags. */
  acceptDraft: async ({ locals, params }) => {
    const db = locals.supabase;
    const id = cardId(params.id);
    const { data, error: e } = await db.from('effect_card_tags').select('pending_draft,pending_text_hash').eq('card_id', id).single();
    if (e) return fail(500, { errors: [e.message] });
    if (!data.pending_draft || !data.pending_text_hash) return fail(400, { errors: ['No draft to accept'] });
    const draft = tagOutputSchema.parse(data.pending_draft);
    await storeCardTags(db, {
      cardId: id,
      textHash: data.pending_text_hash,
      output: draft,
      names: await loadNameIndexFor(db, draft),
      relatedIds: await loadRelatedIds(db, id),
      model: null,
      promptVersion: null,
      mode: 'manual',
    });
    return { acceptedDraft: true };
  },

  /** Keep the hand-corrected tags for the new text: marks them current and drops the draft. */
  discardDraft: async ({ locals, params }) => {
    const db = locals.supabase;
    const id = cardId(params.id);
    const { data, error: e } = await db.from('effect_card_tags').select('pending_text_hash').eq('card_id', id).single();
    if (e) return fail(500, { errors: [e.message] });
    if (!data.pending_text_hash) return fail(400, { errors: ['No draft to discard'] });
    const upd = await db
      .from('effect_card_tags')
      .update({ text_hash: data.pending_text_hash, pending_draft: null, pending_text_hash: null })
      .eq('card_id', id);
    if (upd.error) return fail(500, { errors: [upd.error.message] });
    return { discardedDraft: true };
  },

  /** Copies the card's current tags into the gold set (as the expected output). */
  addGold: async ({ locals, params, request }) => {
    const db = locals.supabase;
    const id = cardId(params.id);
    const notes = String((await request.formData()).get('notes') ?? '').trim();
    const [tags, card] = await Promise.all([db.from('effect_card_tags').select('output,text_hash').eq('card_id', id).single(), loadCard(db, id)]);
    if (tags.error) return fail(500, { errors: [tags.error.message] });
    if (!tags.data.output) return fail(400, { errors: [`${card.name} has no tags to copy`] });
    const { error: e } = await db.from('effect_gold_cards').upsert(
      {
        card_id: id,
        expected: tags.data.output as Json,
        text_hash: tags.data.text_hash,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' },
    );
    if (e) return fail(500, { errors: [e.message] });
    return { addedGold: true };
  },
};
