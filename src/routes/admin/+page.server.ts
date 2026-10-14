import type { PageServerLoad } from './$types';

const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
  const { count: n, error } = await q;
  if (error) console.error('[admin] count failed', error.message);
  return n ?? 0;
};

export const load: PageServerLoad = async ({ locals, url }) => {
  const db = locals.supabase;
  const q = url.searchParams.get('q')?.trim() ?? '';

  const [tagged, locked, drafts, queued, gold, pendingSuggestions, runs, results] = await Promise.all([
    count(db.from('effect_card_tags').select('card_id', { count: 'exact', head: true })),
    count(db.from('effect_card_tags').select('card_id', { count: 'exact', head: true }).eq('locked', true)),
    count(db.from('effect_card_tags').select('card_id', { count: 'exact', head: true }).not('pending_draft', 'is', null)),
    count(db.from('effect_tag_queue').select('card_id', { count: 'exact', head: true })),
    count(db.from('effect_gold_cards').select('card_id', { count: 'exact', head: true })),
    count(db.from('effect_vocab_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    db
      .from('effect_tag_runs')
      .select('id,kind,status,model,cards_total,cards_done,cards_failed,started_at,finished_at,error')
      .order('started_at', { ascending: false })
      .limit(5),
    q
      ? db
          .from('neuron_cards')
          .select('id,name')
          .eq('language', 'en')
          .ilike('name', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
          .order('name')
          .limit(50)
      : Promise.resolve({ data: [] as { id: number; name: string }[], error: null }),
  ]);
  if (runs.error) console.error('[admin] runs', runs.error.message);
  if (results.error) console.error('[admin] search', results.error.message);

  const ids = (results.data ?? []).map((c) => c.id);
  const tagState = ids.length ? await db.from('effect_card_tags').select('card_id,locked,pending_draft').in('card_id', ids) : { data: [] };
  const state = new Map((tagState.data ?? []).map((t) => [t.card_id, t.pending_draft ? 'draft' : t.locked ? 'locked' : 'tagged']));

  return {
    q,
    stats: { tagged, locked, drafts, queued, gold, pendingSuggestions },
    runs: runs.data ?? [],
    results: (results.data ?? []).map((c) => ({ ...c, state: state.get(c.id) ?? 'untagged' })),
  };
};
