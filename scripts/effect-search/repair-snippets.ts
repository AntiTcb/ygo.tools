/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Repairs stored snippets that were cut short at a double quote (see repairSnippets), in both the
// tagger output (effect_card_tags.output) and the stored effects (effect_effects.snippet). Tags
// written since the fix are repaired as they are created; this fixes the ones from before.
//
//   pnpm effect-search:repair-snippets --dry-run   # counts and a few samples
//   pnpm effect-search:repair-snippets
import { fetchAll } from '../../src/lib/effect-search/db';
import { repairSnippets } from '../../src/lib/effect-search/snippets';
import type { TagOutput } from '../../src/lib/effect-search/tagSchema';
import type { Json } from '../../src/lib/db/database.types';
import { args, mapPool, supabase } from './lib';

const { values } = args({ 'dry-run': { type: 'boolean', default: false }, concurrency: { type: 'string', default: '8' } });
const db = supabase();

const tags = (await fetchAll((f, t) => db.from('effect_card_tags').select('card_id,output').order('card_id').range(f, t))) as unknown as {
  card_id: number;
  output: TagOutput;
}[];
const texts = new Map<number, { card: string | null; pendulum: string | null }>();
const ids = tags.map((t) => t.card_id);
for (let i = 0; i < ids.length; i += 500) {
  const { data, error } = await db
    .from('neuron_cards')
    .select('id,effect_text,pendulum_text')
    .in('id', ids.slice(i, i + 500))
    .eq('language', 'en');
  if (error) throw new Error(error.message);
  for (const r of data) texts.set(r.id, { card: r.effect_text, pendulum: r.pendulum_text });
}

const changes = tags.flatMap((t) => {
  const text = texts.get(t.card_id);
  if (!text || !t.output?.effects) return [];
  const effects = repairSnippets(t.output.effects, text);
  const changed = effects.filter((e, i) => e.snippet !== t.output.effects[i]!.snippet);
  return changed.length ? [{ cardId: t.card_id, output: { ...t.output, effects }, changed }] : [];
});
console.log(`${tags.length} tagged cards; ${changes.length} cards with ${changes.reduce((n, c) => n + c.changed.length, 0)} snippets to repair.`);
for (const c of changes.slice(0, 3)) for (const e of c.changed) console.log(`  ${c.cardId} [${e.text_source} ${e.effect_index}] ${e.snippet}`);
if (values['dry-run']) process.exit(0);

let done = 0;
await mapPool(changes, Number(values.concurrency), async (c) => {
  const { error } = await db
    .from('effect_card_tags')
    .update({ output: c.output as unknown as Json })
    .eq('card_id', c.cardId);
  if (error) throw new Error(`${c.cardId}: ${error.message}`);
  for (const e of c.changed) {
    const { error: effectError } = await db
      .from('effect_effects')
      .update({ snippet: e.snippet })
      .eq('card_id', c.cardId)
      .eq('text_source', e.text_source)
      .eq('effect_index', e.effect_index);
    if (effectError) throw new Error(`${c.cardId}: ${effectError.message}`);
  }
  if (++done % 500 === 0) console.log(`${done}/${changes.length}`);
});
console.log(`repaired ${done} cards.`);
