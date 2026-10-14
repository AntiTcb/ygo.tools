/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Tags specific cards and prints the output, for prompt iteration.
//
//   pnpm effect-search:tag "Toadally Awesome" "Swap Frog"
//   pnpm effect-search:tag 12642 --model glm-5.3-flash --reasoning high
//   pnpm effect-search:tag "Swap Frog" --store     # also write the tags to the DB
//
// Cards with a gold entry are scored against it.
import { MODELS, usageCostUsd } from '../../src/lib/effect-search/ai';
import { toTaggerCard } from '../../src/lib/effect-search/cardText';
import { loadCardPool, loadRelatedIds, storeCardTags } from '../../src/lib/effect-search/db';
import { cardPoolTargetComparer, scoreCard } from '../../src/lib/effect-search/evalScore';
import { buildUserPrompt } from '../../src/lib/effect-search/prompt';
import { makeNameResolver } from '../../src/lib/effect-search/store';
import { tagCard } from '../../src/lib/effect-search/tagger';
import { tagOutputSchema } from '../../src/lib/effect-search/tagSchema';
import { aiClient, args, parseModel, parseReasoning, supabase, taggerConfig, usd } from './lib';

const { values, positionals } = args({
  model: { type: 'string', default: 'kimi-k2.6' },
  reasoning: { type: 'string' },
  store: { type: 'boolean', default: false },
});
if (!positionals.length) {
  console.error('Usage: pnpm effect-search:tag <name or id>... [--model kimi-k2.6] [--reasoning none|high] [--store]');
  process.exit(1);
}

const db = supabase();
const model = parseModel(values.model);
const pool = await loadCardPool(db);
const cfg = { ...(await taggerConfig(db, model, parseReasoning(values.reasoning))), client: aiClient() };
const compare = cardPoolTargetComparer(pool.cards, pool.complexRows, makeNameResolver(pool.names));

for (const ref of positionals) {
  const card = /^\d+$/.test(ref) ? pool.byId.get(Number(ref)) : pool.cards.find((c) => c.name.toLowerCase() === ref.toLowerCase());
  if (!card) {
    console.error(`\nNo English card "${ref}"`);
    continue;
  }
  const taggerCard = toTaggerCard(card, pool.frameNames);
  console.log(`\n=== ${card.name} (${card.id}) ===\n${buildUserPrompt(taggerCard)}`);
  const res = await tagCard(taggerCard, cfg);
  console.log(
    `attempts ${res.attempts}, ${res.usage.promptTokens} in (${res.usage.cachedPromptTokens} cached) / ${res.usage.completionTokens} out, ${usd(usageCostUsd(MODELS[model], res.usage))}`,
  );
  if (!res.ok) {
    console.log(`FAILED: ${res.error}\nlast reply: ${res.lastContent}`);
    continue;
  }
  console.log(JSON.stringify(res.output, null, 2));

  const { data: gold } = await db.from('effect_gold_cards').select('expected').eq('card_id', card.id).maybeSingle();
  if (gold) {
    const s = scoreCard(tagOutputSchema.parse(gold.expected), res.output, compare);
    console.log(`gold score ${s.score.toFixed(2)}${s.notes.length ? `\n  ${s.notes.join('\n  ')}` : ''}`);
  }
  if (values.store) {
    const result = await storeCardTags(db, {
      cardId: card.id,
      output: res.output,
      names: pool.names,
      relatedIds: await loadRelatedIds(db, card.id),
      model: cfg.model,
      promptVersion: cfg.promptVersion,
      mode: 'tagger',
    });
    console.log(`DB: ${result}`);
  }
}
