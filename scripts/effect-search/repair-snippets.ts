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

const { values } = args({ 'dry-run': { type: 'boolean', default: false }, concurrency: { type: 'string', default: '4' } });
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

/** Retries a write a few times: long runs of small writes occasionally drop a connection. */
const write = async (label: string, run: () => PromiseLike<{ error: { message: string } | null }>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const { error } = await run();
      if (!error) return;
      if (attempt >= 4) throw new Error(`${label}: ${error.message}`);
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
};

let done = 0;
await mapPool(changes, Number(values.concurrency), async (c) => {
  await write(String(c.cardId), () =>
    db
      .from('effect_card_tags')
      .update({ output: c.output as unknown as Json })
      .eq('card_id', c.cardId),
  );
  for (const e of c.changed) {
    await write(String(c.cardId), () =>
      db
        .from('effect_effects')
        .update({ snippet: e.snippet })
        .eq('card_id', c.cardId)
        .eq('text_source', e.text_source)
        .eq('effect_index', e.effect_index),
    );
  }
  if (++done % 250 === 0) console.log(`${done}/${changes.length}`);
});
console.log(`repaired ${done} cards.`);
