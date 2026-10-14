import type { RunPlan } from '$lib/effect-search/runner';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
  const db = locals.supabase;
  const [runs, queued, retag] = await Promise.all([
    db
      .from('effect_tag_runs')
      .select(
        'id,kind,source,version,status,model,prompt_version,cards_total,cards_done,cards_failed,error,started_at,finished_at,workflow_instance_id',
      )
      .order('started_at', { ascending: false })
      .limit(30),
    db.from('effect_tag_queue').select('card_id', { count: 'exact', head: true }),
    db.from('effect_card_tags').select('card_id', { count: 'exact', head: true }).not('retag_reason', 'is', null),
  ]);
  for (const r of [runs, queued, retag]) if (r.error) console.error('[admin/runs]', r.error.message);
  return {
    runs: runs.data ?? [],
    queued: queued.count ?? 0,
    retagRequests: retag.count ?? 0,
    canRun: Boolean(platform?.env?.EFFECT_TAG_WORKFLOW),
  };
};

export const actions: Actions = {
  /** Starts a tagging run now instead of waiting for the hourly cron. */
  runNow: async ({ locals, platform }) => {
    const workflow = platform?.env?.EFFECT_TAG_WORKFLOW;
    if (!workflow) return fail(503, { error: 'The tagging Workflow binding is unavailable here (it only exists on Cloudflare).' });
    const running = await locals.supabase.from('effect_tag_runs').select('id', { count: 'exact', head: true }).eq('status', 'running');
    if (running.count) return fail(409, { error: 'A run is already in progress.' });
    const plan: RunPlan = { kind: 'manual', source: null, version: null, reason: 'started from /admin' };
    const instance = await workflow.create({ params: { plan } });
    return { message: `Started run ${instance.id}. It appears below once its first step runs.` };
  },
};
