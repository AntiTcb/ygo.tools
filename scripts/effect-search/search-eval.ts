/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Runs the /search regression cases (search-cases.ts) against the live tags: each case's query must
// return its `include` cards (at the tier given, or better) and none of its `exclude` cards, and the
// effect text shown for them must be printed on the card. Exits 1 when a case fails.
//
//   pnpm effect-search:search-eval                  # the stored queries (no model calls)
//   pnpm effect-search:search-eval --parse          # also parse each request with the model, end to end
//   pnpm effect-search:search-eval --only mill,draw
import { MODELS } from '../../src/lib/effect-search/ai';
import { loadVocab } from '../../src/lib/effect-search/db';
import { describeQuery, isNamedCard, searchQuerySchema, TIERS, type SearchQuery } from '../../src/lib/effect-search/query';
import { buildParserJsonSchema, buildParserPrompt, parseSearchRequest } from '../../src/lib/effect-search/queryParser';
import { parseView } from '../../src/lib/effect-search/resultView';
import { getCardPool, lookupCard, runSearch } from '../../src/lib/effect-search/searchEngine';
import { isPrintedSnippet } from '../../src/lib/effect-search/snippets';
import { currentCardName } from '../../src/lib/effect-search/store';
import { aiClient, args, effortFor, parseModel, supabase } from './lib';
import { SEARCH_CASES, type SearchCase } from './search-cases';

const { values } = args({
  parse: { type: 'boolean', default: false },
  model: { type: 'string', default: 'glm-5.3' },
  only: { type: 'string' },
});
const db = supabase();
const pool = await getCardPool(db);
const textOf = new Map(pool.cards.map((c) => [currentCardName(c.name).toLowerCase(), [c.effect_text, c.pendulum_text].filter(Boolean).join('\n')]));
const view = { ...parseView(new URLSearchParams()), pageSize: Number.MAX_SAFE_INTEGER };

const only = values.only?.split(',').map((s) => s.trim());
const cases = SEARCH_CASES.filter((c) => !only || only.includes(c.id));
const unknown = cases
  .flatMap((c) => [...c.include.map((i) => (typeof i === 'string' ? i : i.card)), ...c.exclude])
  .filter((n) => !textOf.has(n.toLowerCase()));
if (unknown.length) {
  console.error(`Unknown card names in search-cases.ts: ${[...new Set(unknown)].join(', ')}`);
  process.exit(1);
}

const parser = values.parse
  ? await (async () => {
      const key = parseModel(values.model);
      const { prompt, vocab } = await loadVocab(db);
      const opts = {
        client: aiClient(),
        model: MODELS[key].id,
        systemPrompt: buildParserPrompt(prompt),
        jsonSchema: buildParserJsonSchema(vocab),
        vocab,
        reasoningEffort: effortFor(key, undefined),
      };
      return async (request: string): Promise<SearchQuery | string> => {
        const res = await parseSearchRequest(request, opts);
        if (!res.ok) return `parse failed: ${res.error.slice(0, 120)}`;
        return 'query' in res.reply ? res.reply.query : `unsupported: ${res.reply.unsupported}`;
      };
    })()
  : null;

/** Problems with one query's results for a case (empty = pass). */
const check = async (c: SearchCase, query: SearchQuery): Promise<{ problems: string[]; total: number }> => {
  const res = await runSearch(db, query, view);
  if (res.kind === 'unknown_card') return { problems: [`unknown card "${res.name}"`], total: 0 };
  const hits = new Map(res.hits.map((h) => [h.card.name.toLowerCase(), h]));
  // "affected_by" shows the source card's effect; a described source has no one card to check against.
  const source = query.mode === 'affected_by' ? (isNamedCard(query.source) ? lookupCard(pool, query.source.card) : null) : undefined;
  const problems: string[] = [];
  for (const inc of c.include) {
    const { card, tier } = typeof inc === 'string' ? { card: inc, tier: null } : inc;
    const hit = hits.get(card.toLowerCase());
    if (!hit) {
      problems.push(`missing ${card}`);
      continue;
    }
    if (tier && TIERS.indexOf(hit.tier) > TIERS.indexOf(tier)) problems.push(`${card} is ${hit.tier}, want ${tier}`);
    if (source === null) continue;
    const text = textOf.get(currentCardName(source?.name ?? card).toLowerCase())!;
    const unprinted = hit.reasons.filter((r) => !isPrintedSnippet(text, r.snippet));
    problems.push(...unprinted.map((r) => `${card}: snippet not on the card: "${r.snippet.slice(0, 60)}…"`));
  }
  for (const card of c.exclude) {
    const hit = hits.get(card.toLowerCase());
    if (hit) problems.push(`false positive ${card} [${hit.tier}]: ${hit.reasons[0]?.why ?? ''}`);
  }
  return { problems, total: res.total };
};

const rows: Record<string, string | number>[] = [];
let failed = 0;
for (const c of cases) {
  const stored = await check(c, searchQuerySchema.parse(c.query));
  const row: Record<string, string | number> = {
    case: c.id,
    cards: stored.total,
    stored: stored.problems.length ? `✗ ${stored.problems.length}` : '✓',
  };
  const lines = stored.problems.map((p) => `    stored: ${p}`);
  if (parser) {
    const parsed = await parser(c.request);
    if (typeof parsed === 'string') {
      row.parsed = '✗ parse';
      lines.push(`    parsed: ${parsed}`);
    } else {
      const res = await check(c, parsed);
      row.parsed = res.problems.length ? `✗ ${res.problems.length}` : '✓';
      if (res.problems.length) {
        lines.push(`    parsed as: ${describeQuery(parsed)}`, `    ${JSON.stringify(parsed)}`, ...res.problems.map((p) => `    parsed: ${p}`));
      }
    }
  }
  const ok = !lines.length;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${c.id}${lines.length ? `\n${lines.join('\n')}` : ''}`);
  if (!ok && c.note) console.log(`    note: ${c.note}`);
  rows.push(row);
}
console.table(rows);
console.log(`${cases.length - failed}/${cases.length} cases pass`);
process.exit(failed ? 1 : 0);
