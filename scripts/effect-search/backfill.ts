/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Tags every card in effect_tag_queue (never tagged, or text changed) and stores the results.
// Phase 3 replaces this with the scheduled Workflow; this is the one-off local backfill.
//
//   pnpm effect-search:backfill --dry-run                 # queue size and cost estimate only
//   pnpm effect-search:backfill --limit 200               # try a slice first
//   pnpm effect-search:backfill --max-cost 40 --concurrency 6
//   pnpm effect-search:backfill --retag-old-prompt         # also re-tag cards tagged by an older prompt
//
// Progress is recorded in effect_tag_runs (kind 'backfill'). Locked (hand-corrected) cards get a
// pending draft instead of being overwritten. Safe to re-run: stored cards leave the queue.
import { MODELS, usageCostUsd } from '../../src/lib/effect-search/ai';
import { toTaggerCard } from '../../src/lib/effect-search/cardText';
import { fetchAll, loadCardPool, loadRelatedIds, storeCardTags } from '../../src/lib/effect-search/db';
import { tagCard } from '../../src/lib/effect-search/tagger';
import { TAG_PROMPT_VERSION } from '../../src/lib/effect-search/prompt';
import { aiClient, args, mapPool, parseModel, parseReasoning, supabase, taggerConfig, usd, writeReport } from './lib';

const { values } = args({
  model: { type: 'string', default: 'kimi-k2.6' },
  reasoning: { type: 'string' },
  limit: { type: 'string' },
  concurrency: { type: 'string', default: '4' },
  'max-cost': { type: 'string' },
  /** Expected USD per card, for --dry-run and the --max-cost guard before real numbers come in. */
  'est-per-card': { type: 'string', default: '0.0025' },
  'dry-run': { type: 'boolean', default: false },
  /** Also re-tag unlocked cards tagged by an older prompt version. */
  'retag-old-prompt': { type: 'boolean', default: false },
});

const db = supabase();
const model = parseModel(values.model);
const maxCost = values['max-cost'] ? Number(values['max-cost']) : Infinity;

// View columns come back nullable in the generated types; the view never yields null ids.
let queue: { card_id: number; text_hash: string | null; locked: boolean | null }[] = (
  await fetchAll((from, to) => db.from('effect_tag_queue').select('card_id,text_hash,locked').order('card_id').range(from, to))
).filter((q): q is typeof q & { card_id: number } => q.card_id !== null);

if (values['retag-old-prompt']) {
  // Unlocked cards whose text is unchanged but were tagged by an older prompt (hand-corrected cards stay as they are).
  const old = await fetchAll((from, to) =>
    db
      .from('effect_card_tags')
      .select('card_id,text_hash')
      .eq('locked', false)
      .neq('prompt_version', TAG_PROMPT_VERSION)
      .order('card_id')
      .range(from, to),
  );
  const queued = new Set(queue.map((q) => q.card_id));
  queue = [...queue, ...old.filter((o) => !queued.has(o.card_id)).map((o) => ({ ...o, locked: false }))].sort((a, b) => a.card_id - b.card_id);
}
if (values.limit) queue = queue.slice(0, Number(values.limit));
const estimate = queue.length * Number(values['est-per-card']);
console.log(
  `${queue.length} cards queued (${queue.filter((q) => q.locked).length} locked -> drafts). Estimated ${usd(estimate)} at ${usd(Number(values['est-per-card']))}/card.`,
);
if (values['dry-run'] || !queue.length) process.exit(0);

const pool = await loadCardPool(db);
const cfg = { ...(await taggerConfig(db, model, parseReasoning(values.reasoning))), client: aiClient(), maxAttempts: 3 };

const { data: run, error: runError } = await db
  .from('effect_tag_runs')
  .insert({ kind: 'backfill', model: cfg.model, prompt_version: cfg.promptVersion, cards_total: queue.length })
  .select('id')
  .single();
if (runError) throw new Error(runError.message);

let done = 0;
let failed = 0;
let cost = 0;
let stopped = false;
const failures: { card_id: number; name: string; error: string }[] = [];

const progress = () =>
  db
    .from('effect_tag_runs')
    .update({ cards_done: done, cards_failed: failed })
    .eq('id', run.id)
    .then(({ error }) => error && console.error(`progress update failed: ${error.message}`));

const finish = async (status: 'completed' | 'failed', error: string | null) => {
  await db
    .from('effect_tag_runs')
    .update({ status, cards_done: done, cards_failed: failed, error, finished_at: new Date().toISOString() })
    .eq('id', run.id);
  console.log(
    `\n${status}: ${done} stored, ${failed} failed, ${usd(cost)} spent. Failures: ${writeReport('backfill', { runId: run.id, cost, failures })}`,
  );
};

process.on('SIGINT', () => {
  stopped = true;
  console.log('\nStopping after in-flight cards...');
});

const started = Date.now();
await mapPool(queue, Number(values.concurrency), async (q) => {
  if (stopped || cost >= maxCost) return;
  const card = pool.byId.get(q.card_id);
  if (!card) return;
  const res = await tagCard(toTaggerCard(card, pool.frameNames), cfg);
  cost += usageCostUsd(MODELS[model], res.usage);
  if (!res.ok) {
    failed++;
    failures.push({ card_id: q.card_id, name: card.name, error: res.error });
  } else {
    try {
      await storeCardTags(db, {
        cardId: q.card_id,
        textHash: q.text_hash ?? undefined,
        output: res.output,
        names: pool.names,
        relatedIds: await loadRelatedIds(db, q.card_id),
        model: cfg.model,
        promptVersion: cfg.promptVersion,
        mode: 'tagger',
      });
      done++;
    } catch (e) {
      failed++;
      failures.push({ card_id: q.card_id, name: card.name, error: (e as Error).message });
    }
  }
  const n = done + failed;
  if (n % 25 === 0) {
    const rate = n / ((Date.now() - started) / 1000);
    const eta = (queue.length - n) / rate / 60;
    console.log(`${n}/${queue.length} (${failed} failed) ${usd(cost)} spent, ~${eta.toFixed(0)} min left`);
    void progress();
  }
});

if (cost >= maxCost) await finish('failed', `stopped at --max-cost ${usd(maxCost)}`);
else if (stopped) await finish('failed', 'interrupted');
else await finish('completed', null);
