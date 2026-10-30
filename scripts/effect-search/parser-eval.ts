/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Compares models for /search query parsing on a fixed set of requests: validity, the fields that
// matter most (mode, verb, zones, target kind, cost) and latency.
//
//   pnpm effect-search:parser-eval --models kimi-k2.6,gemma-4-26b,gpt-oss-20b
import { MODELS, usageCostUsd } from '../../src/lib/effect-search/ai';
import { loadVocab } from '../../src/lib/effect-search/db';
import { isNamedCard, type SearchQuery } from '../../src/lib/effect-search/query';
import { buildParserJsonSchema, buildParserPrompt, parseSearchRequest } from '../../src/lib/effect-search/queryParser';
import { aiClient, args, effortFor, parseModel, supabase, usd } from './lib';

type Expect = Partial<Pick<SearchQuery, 'mode' | 'verb' | 'from_zones' | 'is_cost' | 'subject_is_self' | 'cause'>> & {
  /** 'card:<name>' for a named card, 'desc' for a description, 'none' for no target. */
  target?: string;
  unsupported?: true;
};

const CASES: [string, Expect][] = [
  [
    'special summon Toadally Awesome from the graveyard',
    { mode: 'does', verb: 'special_summon', from_zones: ['gy'], target: 'card:Toadally Awesome' },
  ],
  ['cards that add a Dark Magician from deck to hand', { mode: 'does', verb: 'add_to_hand', from_zones: ['deck'], target: 'card:Dark Magician' }],
  ['monsters that send a WATER monster to the GY as a cost', { mode: 'does', verb: 'send_to_gy', is_cost: true, target: 'desc' }],
  [
    'effects that trigger when this card is sent to the GY to activate a WATER monster effect',
    { mode: 'responds_to', verb: 'send_to_gy', subject_is_self: true, cause: 'cost' },
  ],
  ['negate the activation of a spell or trap', { mode: 'does', verb: 'negate_activation', target: 'desc' }],
  ['banish cards from the opponent graveyard', { mode: 'does', verb: 'banish', from_zones: ['gy'] }],
  ['mill 3 cards', { mode: 'does', verb: 'send_to_gy', from_zones: ['deck'] }],
  ['cards that trigger when destroyed by battle', { mode: 'responds_to', verb: 'destroy', cause: 'battle' }],
  ['tuners that special summon themselves from the hand', { mode: 'does', verb: 'special_summon', from_zones: ['hand'], target: 'card:__self__' }],
  ['search a level 4 or lower warrior', { mode: 'does', verb: 'add_to_hand', from_zones: ['deck'], target: 'desc' }],
  ['quick effects that destroy a card when the opponent activates something', { verb: 'destroy' }],
  ['whats a good budget deck', { unsupported: true }],
];

const score = (q: SearchQuery, e: Expect): string[] => {
  const misses: string[] = [];
  for (const k of ['mode', 'verb', 'is_cost', 'subject_is_self', 'cause'] as const) {
    if (e[k] !== undefined && q[k] !== e[k]) misses.push(`${k}: ${JSON.stringify(q[k])} != ${JSON.stringify(e[k])}`);
  }
  if (e.from_zones && JSON.stringify([...q.from_zones].sort()) !== JSON.stringify([...e.from_zones].sort())) {
    misses.push(`from_zones: ${q.from_zones} != ${e.from_zones}`);
  }
  if (e.target) {
    const got = !q.target ? 'none' : isNamedCard(q.target) ? `card:${q.target.card}` : 'desc';
    if (got.toLowerCase() !== e.target.toLowerCase()) misses.push(`target: ${got} != ${e.target}`);
  }
  return misses;
};

const { values } = args({ models: { type: 'string', default: 'kimi-k2.6,gemma-4-26b,gpt-oss-20b,llama-3.3-70b-fast,glm-5.3-flash' } });
const db = supabase();
const { prompt, vocab } = await loadVocab(db);
const systemPrompt = buildParserPrompt(prompt);
const jsonSchema = buildParserJsonSchema(vocab);
const client = aiClient();

const rows = [];
for (const key of values.models.split(',').map((m) => parseModel(m.trim()))) {
  const model = MODELS[key];
  let correct = 0;
  let invalid = 0;
  let cost = 0;
  const times: number[] = [];
  const notes: string[] = [];
  for (const [request, expect] of CASES) {
    const res = await parseSearchRequest(request, {
      client,
      model: model.id,
      systemPrompt,
      jsonSchema,
      vocab,
      reasoningEffort: effortFor(key, undefined),
    });
    times.push(res.ms);
    if (res.usage) cost += usageCostUsd(model, res.usage);
    if (!res.ok) {
      invalid++;
      notes.push(`  ✗ ${request}: ${res.error.slice(0, 120)}`);
      continue;
    }
    const misses =
      'unsupported' in res.reply
        ? expect.unsupported
          ? []
          : ['unsupported']
        : expect.unsupported
          ? ['should be unsupported']
          : score(res.reply.query, expect);
    if (misses.length) notes.push(`  · ${request}: ${misses.join(', ')}`);
    else correct++;
  }
  times.sort((a, b) => a - b);
  rows.push({
    model: key,
    correct: `${correct}/${CASES.length}`,
    invalid,
    'median s': (times[Math.floor(times.length / 2)]! / 1000).toFixed(1),
    'max s': (times.at(-1)! / 1000).toFixed(1),
    '$/query': usd(cost / CASES.length),
  });
  console.log(`\n${key}\n${notes.join('\n') || '  all correct'}`);
}
console.table(rows);
