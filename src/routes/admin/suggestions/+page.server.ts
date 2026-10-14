import { fetchAll } from '$lib/effect-search/db';
import { approveSuggestions, mergeSuggestions, rejectSuggestions, type VocabKind } from '$lib/effect-search/vocabAdmin';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 25;

type Cluster = {
  key: string;
  kind: VocabKind;
  ids: number[];
  terms: string[];
  occurrences: number;
  asAction: boolean;
  asEvent: boolean;
  description: string | null;
  phrases: string[];
  exampleCardIds: number[];
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const db = locals.supabase;
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);

  const pending = await fetchAll((from, to) =>
    db
      .from('effect_vocab_suggestions')
      .select('id,kind,proposed_term,description,phrases,example_card_ids,occurrences,as_action,as_event,cluster_key')
      .eq('status', 'pending')
      .order('id')
      .range(from, to),
  );

  // Unclustered suggestions stand alone until the next run's clustering pass.
  const clusters = new Map<string, Cluster>();
  for (const s of pending) {
    const key = `${s.kind}:${s.cluster_key ?? s.proposed_term}`;
    const c = clusters.get(key) ?? {
      key: s.cluster_key ?? s.proposed_term,
      kind: s.kind,
      ids: [],
      terms: [],
      occurrences: 0,
      asAction: false,
      asEvent: false,
      description: null,
      phrases: [],
      exampleCardIds: [],
    };
    c.ids.push(s.id);
    c.terms.push(s.proposed_term);
    c.occurrences += s.occurrences;
    c.asAction ||= s.as_action;
    c.asEvent ||= s.as_event;
    c.description ??= s.description;
    c.phrases.push(...s.phrases);
    c.exampleCardIds.push(...s.example_card_ids);
    clusters.set(key, c);
  }
  const sorted = [...clusters.values()].sort((a, b) => b.occurrences - a.occurrences);
  const shown = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((c) => ({
    ...c,
    terms: [...new Set(c.terms)],
    phrases: [...new Set(c.phrases)].slice(0, 5),
    exampleCardIds: [...new Set(c.exampleCardIds)].slice(0, 6),
  }));

  const exampleIds = [...new Set(shown.flatMap((c) => c.exampleCardIds))];
  const [cards, verbs, zones] = await Promise.all([
    exampleIds.length
      ? db.from('neuron_cards').select('id,name').eq('language', 'en').in('id', exampleIds)
      : Promise.resolve({ data: [], error: null }),
    db.from('effect_vocab_verbs').select('id,term,usable_as_action,usable_as_event').is('retired_at', null).order('term'),
    db.from('effect_vocab_zones').select('id,term').is('retired_at', null).order('term'),
  ]);
  for (const r of [cards, verbs, zones]) if (r.error) console.error('[admin/suggestions]', r.error.message);
  const cardNames = Object.fromEntries((cards.data ?? []).map((c) => [c.id, c.name]));
  const existing = new Set([...(verbs.data ?? []).map((v) => v.term), ...(zones.data ?? []).map((z) => z.term)]);

  return {
    page,
    pages: Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)),
    totalClusters: sorted.length,
    totalSuggestions: pending.length,
    unclustered: pending.filter((s) => !s.cluster_key).length,
    clusters: shown.map((c) => ({ ...c, matchesExisting: existing.has(c.key) })),
    cardNames,
    verbs: verbs.data ?? [],
    zones: zones.data ?? [],
  };
};

const ids = (form: FormData) =>
  String(form.get('ids') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

const kindOf = (form: FormData): VocabKind => (form.get('kind') === 'zone' ? 'zone' : 'verb');

const run = async (key: string, fn: () => Promise<string>) => {
  try {
    return { key, message: await fn() };
  } catch (e) {
    return fail(400, { key, error: (e as Error).message });
  }
};

export const actions: Actions = {
  approve: async ({ locals, request }) => {
    const form = await request.formData();
    return run(String(form.get('key')), async () => {
      const term = String(form.get('term') ?? '').trim();
      const res = await approveSuggestions(locals.supabase, ids(form), {
        kind: kindOf(form),
        term,
        description: String(form.get('description') ?? ''),
        usableAsAction: form.get('as_action') === 'on',
        usableAsEvent: form.get('as_event') === 'on',
      });
      return `Added "${term}"; ${res.retagged} cards queued for re-tagging.`;
    });
  },

  merge: async ({ locals, request }) => {
    const form = await request.formData();
    return run(String(form.get('key')), async () => {
      const res = await mergeSuggestions(locals.supabase, ids(form), kindOf(form), Number(form.get('term_id')));
      return `Merged; ${res.retagged} cards queued for re-tagging.`;
    });
  },

  reject: async ({ locals, request }) => {
    const form = await request.formData();
    return run(String(form.get('key')), async () => {
      await rejectSuggestions(locals.supabase, ids(form));
      return 'Rejected.';
    });
  },
};
