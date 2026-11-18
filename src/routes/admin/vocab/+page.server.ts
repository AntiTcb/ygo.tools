import { renameTerm, retireTerm, updateTerm, type VocabKind } from '#lib/effect-search/vocabAdmin.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const db = locals.supabase;
  const [verbs, zones, usage] = await Promise.all([
    db.from('effect_vocab_verbs').select('id,term,description,usable_as_action,usable_as_event,retired_at,replaced_by').order('term'),
    db.from('effect_vocab_zones').select('id,term,description,retired_at,replaced_by').order('term'),
    db.from('effect_vocab_usage').select('kind,id,actions,triggers'),
  ]);
  for (const r of [verbs, zones, usage]) if (r.error) console.error('[admin/vocab]', r.error.message);
  const used = new Map((usage.data ?? []).map((u) => [`${u.kind}:${u.id}`, { actions: u.actions ?? 0, triggers: u.triggers ?? 0 }]));
  const withUsage = <T extends { id: number }>(kind: VocabKind, rows: T[]) =>
    rows.map((r) => ({ ...r, ...(used.get(`${kind}:${r.id}`) ?? { actions: 0, triggers: 0 }) }));
  return { verbs: withUsage('verb', verbs.data ?? []), zones: withUsage('zone', zones.data ?? []) };
};

const target = (form: FormData) => ({ kind: (form.get('kind') === 'zone' ? 'zone' : 'verb') as VocabKind, id: Number(form.get('id')) });

const run = async (key: string, fn: () => Promise<string>) => {
  try {
    return { key, message: await fn() };
  } catch (e) {
    return fail(400, { key, error: (e as Error).message });
  }
};

export const actions: Actions = {
  update: async ({ locals, request }) => {
    const form = await request.formData();
    const { kind, id } = target(form);
    return run(`${kind}:${id}`, async () => {
      const term = String(form.get('term') ?? '').trim();
      if (term && term !== form.get('current_term')) await renameTerm(locals.supabase, kind, id, term);
      await updateTerm(locals.supabase, kind, id, {
        description: String(form.get('description') ?? ''),
        usableAsAction: form.get('as_action') === 'on',
        usableAsEvent: form.get('as_event') === 'on',
      });
      return 'Saved. Tagging runs pick it up from now on.';
    });
  },

  retire: async ({ locals, request }) => {
    const form = await request.formData();
    const { kind, id } = target(form);
    return run(`${kind}:${id}`, async () => {
      const res = await retireTerm(locals.supabase, kind, id, Number(form.get('replacement_id')));
      return `Retired; ${res.retagged} cards queued for re-tagging.`;
    });
  },
};
