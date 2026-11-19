/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Applies the deterministic tag fixes (tagFixes.ts) to stored tags and re-stores the cards they change,
// keeping each card's model and prompt version. No model calls. Tags written since the fixes are fixed
// as they are created; this fixes the ones from before. Locked (hand-corrected) cards are only listed.
//
//   pnpm effect-search:fix-tags --dry-run   # counts and a few samples
//   pnpm effect-search:fix-tags
import { fetchAll, loadCardPool, loadRelatedIds, storeCardTags } from '../../src/lib/effect-search/db';
import { fixTagEffects } from '../../src/lib/effect-search/tagFixes';
import type { TagOutput } from '../../src/lib/effect-search/tagSchema';
import { args, mapPool, supabase } from './lib';

const { values } = args({ 'dry-run': { type: 'boolean', default: false }, concurrency: { type: 'string', default: '4' } });
const db = supabase();

type Row = {
  card_id: number;
  output: TagOutput | null;
  locked: boolean;
  model: string | null;
  prompt_version: string | null;
  text_hash: string;
  source: string;
};
const tags = (await fetchAll((f, t) =>
  db.from('effect_card_tags').select('card_id,output,locked,model,prompt_version,text_hash,source').order('card_id').range(f, t),
)) as unknown as Row[];

const changes = tags.flatMap((t) => {
  if (!t.output?.effects) return [];
  const effects = fixTagEffects(t.output.effects);
  const changed = effects.filter((e, i) => e !== t.output!.effects[i]);
  return changed.length ? [{ tag: t, output: { ...t.output, effects }, before: t.output.effects.filter((e, i) => e !== effects[i]), changed }] : [];
});
const locked = changes.filter((c) => c.tag.locked);
const todo = changes.filter((c) => !c.tag.locked && c.tag.source === 'tagger');
console.log(
  `${tags.length} tagged cards; ${changes.length} to fix (${locked.length} locked, ${changes.length - locked.length - todo.length} hand-made: skipped).`,
);
for (const c of changes.slice(0, 4)) {
  console.log(`  card ${c.tag.card_id}: ${c.changed[0]!.snippet.slice(0, 90)}`);
  console.log(`    before ${JSON.stringify(c.before[0]!.actions.map((a) => [a.from_zones, a.target]))}`);
  console.log(`    after  ${JSON.stringify(c.changed[0]!.actions.map((a) => [a.from_zones, a.target]))}`);
}
if (locked.length) console.log(`Locked cards to fix by hand in /admin: ${locked.map((c) => c.tag.card_id).join(', ')}`);
if (values['dry-run'] || !todo.length) process.exit(0);

const pool = await loadCardPool(db);
let done = 0;
const failed: string[] = [];
await mapPool(todo, Number(values.concurrency), async (c) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await storeCardTags(db, {
        cardId: c.tag.card_id,
        textHash: c.tag.text_hash,
        output: c.output,
        names: pool.names,
        relatedIds: await loadRelatedIds(db, c.tag.card_id),
        model: c.tag.model,
        promptVersion: c.tag.prompt_version,
        mode: 'tagger',
      });
      break;
    } catch (e) {
      // Long runs of small writes occasionally drop a connection.
      if (attempt >= 4) {
        failed.push(`${c.tag.card_id}: ${(e as Error).message}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (++done % 100 === 0) console.log(`${done}/${todo.length}`);
});
console.log(`fixed ${done}/${todo.length}${failed.length ? `; failed:\n  ${failed.join('\n  ')}` : ''}`);
