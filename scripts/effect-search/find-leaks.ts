/* oxlint-disable no-console -- CLI script: the report is the point. */
// Lists target restrictions that aren't where their action is (tagLeaks.ts): copied from another effect,
// from another clause of the same effect, or printed nowhere on the card. Read-only.
//
//   pnpm effect-search:find-leaks                          # summary + values leaked from another effect
//   pnpm effect-search:find-leaks --kind other_clause --limit 50
//   pnpm effect-search:find-leaks --kind all --json leaks.json
import { writeFileSync } from 'node:fs';
import { fetchAll, loadCardPool } from '../../src/lib/effect-search/db';
import { repairSnippets } from '../../src/lib/effect-search/snippets';
import { currentCardName } from '../../src/lib/effect-search/store';
import { findLeaks, LEAK_KINDS, type Leak, type LeakKind } from '../../src/lib/effect-search/tagLeaks';
import type { TagOutput } from '../../src/lib/effect-search/tagSchema';
import { args, supabase } from './lib';

const { values } = args({
  kind: { type: 'string', default: 'other_effect' },
  limit: { type: 'string', default: '40' },
  json: { type: 'string' },
});
if (values.kind !== 'all' && !LEAK_KINDS.includes(values.kind as LeakKind)) {
  console.error(`--kind must be one of ${LEAK_KINDS.join(', ')} or all`);
  process.exit(1);
}

const db = supabase();
const pool = await loadCardPool(db);
const tags = (await fetchAll((f, t) => db.from('effect_card_tags').select('card_id,output,locked').order('card_id').range(f, t))) as unknown as {
  card_id: number;
  output: TagOutput | null;
  locked: boolean;
}[];

type CardLeaks = { cardId: number; name: string; locked: boolean; leaks: Leak[] };
const found: CardLeaks[] = [];
for (const t of tags) {
  const card = pool.byId.get(t.card_id);
  if (!card || !t.output?.effects?.length) continue;
  const effects = repairSnippets(t.output.effects, { card: card.effect_text, pendulum: card.pendulum_text });
  const leaks = findLeaks(effects, [card.effect_text, card.pendulum_text].filter(Boolean).join('\n'));
  if (leaks.length) found.push({ cardId: t.card_id, name: currentCardName(card.name), locked: t.locked, leaks });
}

const cardsWith = (k: LeakKind) => found.filter((c) => c.leaks.some((l) => l.kind === k)).length;
console.log(
  `${tags.length} tagged cards, ${found.length} with findings. Cards per kind: ${LEAK_KINDS.map((k) => `${k} ${cardsWith(k)}`).join(', ')}.`,
);
const byField = new Map<string, number>();
for (const c of found) for (const l of c.leaks) byField.set(`${l.kind} ${l.field}`, (byField.get(`${l.kind} ${l.field}`) ?? 0) + 1);
console.log('Findings per kind and field:');
console.table(Object.fromEntries([...byField].sort((a, b) => b[1] - a[1])));

const shown = found
  .map((c) => ({ ...c, leaks: c.leaks.filter((l) => values.kind === 'all' || l.kind === values.kind) }))
  .filter((c) => c.leaks.length);
const limit = Number(values.limit);
for (const c of shown.slice(0, limit)) {
  console.log(`\n${c.name} (${c.cardId})${c.locked ? ' [locked]' : ''}`);
  for (const l of c.leaks) {
    console.log(`  ${l.kind.padEnd(12)} effect ${l.textSource === 'pendulum' ? 'P' : ''}${l.effectIndex} ${l.where}: ${l.field} ${l.value}`);
    if (l.clause) console.log(`               clause: ${l.clause.slice(0, 140)}`);
  }
}
if (shown.length > limit) console.log(`\n… ${shown.length - limit} more cards (raise --limit, or --json).`);

if (values.json) {
  writeFileSync(values.json, JSON.stringify(found, null, 2));
  console.log(`\nWrote ${found.length} cards to ${values.json}`);
}
