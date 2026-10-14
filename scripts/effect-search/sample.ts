/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Prints a random sample of tagged cards (text next to the stored tags) for spot-checking.
//
//   pnpm effect-search:sample            # 10 tagged cards that have effects
//   pnpm effect-search:sample --n 25
//   pnpm effect-search:sample --cards 4018,4264      # specific card ids
import { describeAction, describeTrigger } from '../../src/lib/effect-search/describe';
import { fetchAll } from '../../src/lib/effect-search/db';
import { tagOutputSchema } from '../../src/lib/effect-search/tagSchema';
import { args, supabase } from './lib';

const { values } = args({ n: { type: 'string', default: '10' }, cards: { type: 'string' } });
const db = supabase();

const tagged = await fetchAll((from, to) => db.from('effect_card_tags').select('card_id,output').order('card_id').range(from, to));
const withEffects = tagged.filter((t) => tagOutputSchema.parse(t.output ?? { effects: [] }).effects.length > 0);
const wanted = values.cards?.split(',').map(Number);
const sample = wanted ? tagged.filter((t) => wanted.includes(t.card_id)) : withEffects.sort(() => Math.random() - 0.5).slice(0, Number(values.n));
const { data: cards, error } = await db
  .from('neuron_cards')
  .select('id,name,effect_text,pendulum_text')
  .eq('language', 'en')
  .in(
    'id',
    sample.map((s) => s.card_id),
  );
if (error) throw new Error(error.message);

console.log(`${tagged.length} tagged, ${withEffects.length} with effects; sampling ${sample.length}\n`);
for (const s of sample) {
  const card = cards.find((c) => c.id === s.card_id)!;
  const out = tagOutputSchema.parse(s.output);
  console.log(`=== ${card.name} (${card.id})\n${card.effect_text}${card.pendulum_text ? `\n[P] ${card.pendulum_text}` : ''}`);
  for (const e of out.effects) {
    console.log(`  #${e.text_source === 'pendulum' ? 'P' : ''}${e.effect_index} ${e.effect_type}${e.opt !== 'none' ? ` opt:${e.opt}` : ''}`);
    for (const t of e.triggers) console.log(`     when ${describeTrigger(t)}`);
    for (const a of e.actions) console.log(`     - ${describeAction(a)}`);
  }
  for (const u of out.unmapped) console.log(`  ? ${u.kind} ${u.proposed_term}: "${u.phrase}"`);
  console.log('');
}
