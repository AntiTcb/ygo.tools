import { METALTRONUS_EXCLUDED_FRAME_TYPE_IDS, isLegalMetaltronusMonster, isTokenFrameName } from '$lib/db/metaltronus';
import type { PageServerLoad } from './$types';

const CARD_SELECT = 'id,name,effect_text,frame_type_id,atk,def,level,attribute_id,species_id,link_rating,pend_scale_l,pend_scale_r';

export const load: PageServerLoad = async ({ locals }) => {
  const [cardsRes, monsterTypesRes, cardFrameTypesRes] = await Promise.all([
    locals.supabase
      .from('neuron_cards')
      .select(CARD_SELECT)
      .eq('language', 'en')
      .not('frame_type_id', 'in', `(${METALTRONUS_EXCLUDED_FRAME_TYPE_IDS.join(',')})`),
    locals.supabase.from('neuron_monster_types').select('id,name').eq('language', 'en'),
    locals.supabase.from('neuron_card_frame_types').select('id,name').eq('language', 'en'),
  ]);

  if (cardsRes.error) {
    console.error('error loading metaltronus monsters', cardsRes.error);
    return { cards: [], lookups: emptyLookups() };
  }

  if (monsterTypesRes.error) console.error('neuron_monster_types', monsterTypesRes.error);
  if (cardFrameTypesRes.error) console.error('neuron_card_frame_types', cardFrameTypesRes.error);

  const tokenFrameTypeIds = new Set((cardFrameTypesRes.data ?? []).filter((row) => isTokenFrameName(row.name)).map((row) => row.id));

  return {
    cards: (cardsRes.data ?? []).filter((card) => isLegalMetaltronusMonster(card, tokenFrameTypeIds)),
    lookups: {
      monsterTypes: monsterTypesRes.data ?? [],
      cardFrameTypes: cardFrameTypesRes.data ?? [],
    },
  };
};

const emptyLookups = () => ({
  monsterTypes: [] as { id: number; name: string | null }[],
  cardFrameTypes: [] as { id: number; name: string }[],
});
