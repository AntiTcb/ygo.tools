/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Runs /search from the command line.
//
//   pnpm effect-search:search "cards that special summon Toadally Awesome from the GY"
//   pnpm effect-search:search --ast '{"mode":"does","verb":"special_summon","from_zones":["gy"],"target":{"card":"Toadally Awesome"}}'
import { MODELS } from '../../src/lib/effect-search/ai';
import { loadVocab } from '../../src/lib/effect-search/db';
import { describeQuery, searchQuerySchema, type SearchQuery } from '../../src/lib/effect-search/query';
import { buildParserJsonSchema, buildParserPrompt, parseSearchRequest } from '../../src/lib/effect-search/queryParser';
import { runSearch, textSearch } from '../../src/lib/effect-search/searchEngine';
import { aiClient, args, effortFor, parseModel, supabase } from './lib';

const { values, positionals } = args({
  ast: { type: 'string' },
  model: { type: 'string', default: 'kimi-k2.6' },
  limit: { type: 'string', default: '25' },
});
const db = supabase();

let query: SearchQuery;
if (values.ast) {
  query = searchQuerySchema.parse(JSON.parse(values.ast));
} else {
  const request = positionals.join(' ');
  if (!request) {
    console.error('Usage: pnpm effect-search:search "<request>" | --ast <json>');
    process.exit(1);
  }
  const key = parseModel(values.model);
  const { prompt, vocab } = await loadVocab(db);
  const res = await parseSearchRequest(request, {
    client: aiClient(),
    model: MODELS[key].id,
    systemPrompt: buildParserPrompt(prompt),
    jsonSchema: buildParserJsonSchema(vocab),
    vocab,
    reasoningEffort: effortFor(key, undefined),
  });
  if (!res.ok) throw new Error(res.error);
  console.log(`parsed in ${(res.ms / 1000).toFixed(1)}s`);
  if ('unsupported' in res.reply) {
    console.log(`unsupported: ${res.reply.unsupported}\ntext search: ${(await textSearch(db, request)).map((c) => c.name).join(', ')}`);
    process.exit(0);
  }
  query = res.reply.query;
}

console.log(`${describeQuery(query)}\n${JSON.stringify(query)}`);
const t0 = Date.now();
const out = await runSearch(db, query);
console.log(`searched in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (out.kind === 'unknown_card') {
  console.log(`No card named "${out.name}". Did you mean: ${out.suggestions.map((s) => s.name).join(', ')}?`);
} else {
  console.log(`${out.total} cards${out.truncated ? ' (truncated)' : ''}`);
  for (const h of out.hits.slice(0, Number(values.limit))) {
    console.log(`[${h.tier}] ${h.card.name}`);
    for (const r of h.reasons.slice(0, 1)) console.log(`    ${r.why}${r.note ? ` (${r.note})` : ''}\n    "${r.snippet.slice(0, 140)}"`);
  }
}
