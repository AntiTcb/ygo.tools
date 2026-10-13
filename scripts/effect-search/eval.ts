/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Scores tagger models against the gold set (effect_gold_cards).
//
//   pnpm effect-search:eval                                   # kimi-k2.6, reasoning none
//   pnpm effect-search:eval --models kimi-k2.6,glm-5.3-flash --reasoning none,high
//   pnpm effect-search:eval --file --cards "Swap Frog,Mirror Force" --verbose
//
// --file reads scripts/effect-search/gold.json instead of the DB. Each model/reasoning pair tags every
// gold card; the report (scores, worst cards, field errors, cost per card and a full-backfill
// estimate) is printed and written to .effect-search/.
import { readFileSync } from 'node:fs';
import { MODELS, usageCostUsd, type ChatUsage } from '../../src/lib/effect-search/ai';
import { toTaggerCard } from '../../src/lib/effect-search/cardText';
import { fetchAll, loadCardPool } from '../../src/lib/effect-search/db';
import { cardPoolTargetComparer, scoreCard, summarize, type CardScore } from '../../src/lib/effect-search/evalScore';
import { makeNameResolver } from '../../src/lib/effect-search/store';
import { tagCard } from '../../src/lib/effect-search/tagger';
import { tagOutputSchema, type TagOutput } from '../../src/lib/effect-search/tagSchema';
import { aiClient, args, mapPool, parseModel, parseReasoning, supabase, taggerConfig, usd, writeReport } from './lib';

const { values } = args({
  models: { type: 'string', default: 'kimi-k2.6' },
  reasoning: { type: 'string', default: 'none' },
  file: { type: 'boolean', default: false },
  cards: { type: 'string' },
  limit: { type: 'string' },
  concurrency: { type: 'string', default: '4' },
  verbose: { type: 'boolean', default: false },
});

const db = supabase();
const models = values.models.split(',').map((m) => parseModel(m.trim()));
const reasonings = values.reasoning.split(',').map((r) => parseReasoning(r.trim()));

console.log('Loading card pool...');
const pool = await loadCardPool(db);
const resolveName = makeNameResolver(pool.names);
const compare = cardPoolTargetComparer(pool.cards, pool.complexRows, resolveName);

type Gold = { card_id: number; expected: TagOutput };
const rawGold: { card_id: number; expected: unknown }[] = values.file
  ? JSON.parse(readFileSync('scripts/effect-search/gold.json', 'utf8'))
  : await fetchAll((from, to) => db.from('effect_gold_cards').select('card_id,expected').order('card_id').range(from, to));
let gold: Gold[] = rawGold.map((g) => ({ card_id: g.card_id, expected: tagOutputSchema.parse(g.expected) }));
if (values.cards) {
  const wanted = values.cards.split(',').map((n) => n.trim().toLowerCase());
  gold = gold.filter((g) => wanted.includes(pool.byId.get(g.card_id)?.name.toLowerCase() ?? ''));
}
if (values.limit) gold = gold.slice(0, Number(values.limit));
if (!gold.length) {
  console.error(values.file ? 'No gold cards matched.' : 'No gold cards in the DB; run pnpm effect-search:gold push (or pass --file).');
  process.exit(1);
}

const { count: queueSize } = await db.from('effect_tag_queue').select('card_id', { count: 'exact', head: true });

const client = aiClient();
const results = [];
for (const model of models) {
  for (const reasoning of MODELS[model].reasoning ? reasonings : [undefined]) {
    const label = `${model}${reasoning ? ` (reasoning ${reasoning})` : ''}`;
    const cfg = { ...(await taggerConfig(db, model, reasoning)), client };
    console.log(`\n${label}: tagging ${gold.length} gold cards...`);
    const started = Date.now();
    const perCard = await mapPool(gold, Number(values.concurrency), async (g) => {
      const card = pool.byId.get(g.card_id);
      if (!card) return { card_id: g.card_id, name: '?', error: 'card not found', score: null, usage: null, ms: 0 };
      const t0 = Date.now();
      const res = await tagCard(toTaggerCard(card, pool.frameNames), cfg);
      const ms = Date.now() - t0;
      const score: CardScore | null = res.ok ? scoreCard(g.expected, res.output, compare) : null;
      process.stdout.write(res.ok ? '.' : 'x');
      return {
        card_id: g.card_id,
        name: card.name,
        attempts: res.attempts,
        error: res.ok ? null : res.error,
        score,
        output: res.ok ? res.output : null,
        usage: res.usage as ChatUsage | null,
        ms,
      };
    });
    process.stdout.write('\n');

    const summary = summarize(perCard.map((r) => r.score));
    const cost = perCard.reduce((n, r) => n + (r.usage ? usageCostUsd(MODELS[model], r.usage) : 0), 0);
    const perCardCost = cost / perCard.length;
    results.push({ label, model, reasoning, summary, cost, perCardCost, wallMs: Date.now() - started, perCard });

    const worst = [...perCard].sort((a, b) => (a.score?.score ?? -1) - (b.score?.score ?? -1));
    for (const r of worst.slice(0, values.verbose ? worst.length : 8)) {
      const s = r.score ? r.score.score.toFixed(2) : 'FAIL';
      console.log(`  ${s}  ${r.name}${r.error ? ` — ${r.error.slice(0, 160)}` : ''}`);
      for (const n of (r.score?.notes ?? []).slice(0, values.verbose ? 50 : 4)) console.log(`        ${n}`);
    }
    console.log(`  top field errors: ${summary.topFieldErrors.map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
    console.log(`  cost ${usd(cost)} (${usd(perCardCost)}/card, ~${usd(perCardCost * (queueSize ?? 0))} for the ${queueSize} queued cards)`);
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
console.log('\nSummary');
console.table(
  results.map((r) => ({
    config: r.label,
    score: pct(r.summary.score),
    actionsF1: pct(r.summary.actionsF1),
    actionFields: pct(r.summary.actionFields),
    triggersF1: pct(r.summary.triggersF1),
    effectFields: pct(r.summary.effectFields),
    unmapped: pct(r.summary.unmappedAgreement),
    failed: r.summary.failed,
    '$/card': usd(r.perCardCost),
    'avg s': (r.perCard.reduce((n, c) => n + c.ms, 0) / r.perCard.length / 1000).toFixed(1),
  })),
);
console.log('Backfill estimates use the gold set, which skews toward complex cards: expect the real per-card cost to be lower.');
console.log(`Report: ${writeReport('eval', results)}`);
