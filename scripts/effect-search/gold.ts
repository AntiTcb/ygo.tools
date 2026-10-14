/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Syncs the effect-search gold set between scripts/effect-search/gold.json and effect_gold_cards.
//
//   pnpm effect-search:gold push    # file -> DB (upsert; text_hash taken from the card's current text)
//   pnpm effect-search:gold pull    # DB -> file (picks up corrections saved from /admin)
//   pnpm effect-search:gold status  # entries whose card text changed since they were labelled
//
// The DB table is what evals read; the file is the reviewable copy in git.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Json } from '../../src/lib/db/database.types';
import { fetchAll } from '../../src/lib/effect-search/db';
import { tagOutputSchema, validateTagOutput } from '../../src/lib/effect-search/tagSchema';
import { loadVocab } from '../../src/lib/effect-search/db';
import { args, supabase, textHash } from './lib';

const FILE = 'scripts/effect-search/gold.json';

type GoldEntry = { card_id: number; name: string; notes?: string; expected: unknown };

const db = supabase();
const { positionals } = args({});
const command = positionals[0];

const cardTexts = async (ids: number[]) => {
  const { data, error } = await db.from('neuron_cards').select('id,name,effect_text,pendulum_text').eq('language', 'en').in('id', ids);
  if (error) throw new Error(error.message);
  return new Map(data.map((c) => [c.id, c]));
};

if (command === 'push') {
  const entries = JSON.parse(readFileSync(FILE, 'utf8')) as GoldEntry[];
  const { vocab } = await loadVocab(db);
  const cards = await cardTexts(entries.map((e) => e.card_id));
  const problems: string[] = [];
  for (const e of entries) {
    const card = cards.get(e.card_id);
    if (!card) problems.push(`${e.name} (${e.card_id}): no English card with that id`);
    else if (card.name !== e.name) problems.push(`${e.card_id}: name is "${card.name}", file says "${e.name}"`);
    const parsed = tagOutputSchema.safeParse(e.expected);
    if (!parsed.success) problems.push(`${e.name}: ${parsed.error.issues[0]?.message}`);
    else problems.push(...validateTagOutput(parsed.data, vocab).map((p) => `${e.name}: ${p}`));
  }
  if (problems.length) {
    console.error(`Not pushing; fix these first:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    process.exit(1);
  }
  const rows = entries.map((e) => {
    const card = cards.get(e.card_id)!;
    return {
      card_id: e.card_id,
      expected: e.expected as Json,
      notes: e.notes ?? null,
      text_hash: textHash(card.effect_text, card.pendulum_text),
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await db.from('effect_gold_cards').upsert(rows, { onConflict: 'card_id' });
  if (error) throw new Error(error.message);
  console.log(`Pushed ${rows.length} gold cards.`);
} else if (command === 'pull') {
  const rows = await fetchAll((from, to) => db.from('effect_gold_cards').select('card_id,expected,notes').order('card_id').range(from, to));
  const cards = await cardTexts(rows.map((r) => r.card_id));
  // Keep the file's order for existing entries so diffs stay readable; new entries go last.
  const existing = (JSON.parse(readFileSync(FILE, 'utf8')) as GoldEntry[]).map((e) => e.card_id);
  const order = (id: number) => (existing.includes(id) ? existing.indexOf(id) : existing.length + id);
  const entries: GoldEntry[] = rows
    .sort((a, b) => order(a.card_id) - order(b.card_id))
    .map((r) => ({ card_id: r.card_id, name: cards.get(r.card_id)?.name ?? '?', ...(r.notes ? { notes: r.notes } : {}), expected: r.expected }));
  writeFileSync(FILE, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`Wrote ${entries.length} gold cards to ${FILE} (run pnpm format to tidy).`);
} else if (command === 'status') {
  const rows = await fetchAll((from, to) => db.from('effect_gold_cards').select('card_id,text_hash').order('card_id').range(from, to));
  const cards = await cardTexts(rows.map((r) => r.card_id));
  const stale = rows.filter((r) => {
    const c = cards.get(r.card_id);
    return !c || textHash(c.effect_text, c.pendulum_text) !== r.text_hash;
  });
  console.log(`${rows.length} gold cards, ${stale.length} stale (card text changed since labelling):`);
  for (const r of stale) console.log(`- ${cards.get(r.card_id)?.name ?? '(missing card)'} (${r.card_id})`);
} else {
  console.error('Usage: pnpm effect-search:gold <push|pull|status>');
  process.exit(1);
}
