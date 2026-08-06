import type { PageServerLoad } from './$types';

const CARD_SELECT =
  'id,name,effect_text,frame_type_id,atk,def,level,attribute_id,species_id,effect_id,link_rating,link_arrows,pend_scale_l,pend_scale_r,pendulum_text';

export const load: PageServerLoad = async ({ locals }) => {
  const [cardsRes, monsterTypesRes, cardFrameTypesRes, complexFrameTypesRes] = await Promise.all([
    locals.supabase.from('neuron_cards').select(CARD_SELECT).eq('language', 'en'),
    locals.supabase.from('neuron_monster_types').select('id,name').eq('language', 'en'),
    locals.supabase.from('neuron_card_frame_types').select('id,name').eq('language', 'en'),
    locals.supabase
      .from('neuron_complex_frame_types')
      .select('id,name,subtype_1,subtype_2,subtype_3')
      .eq('language', 'en'),
  ]);

  if (cardsRes.error) {
    console.error('error loading cards from database', cardsRes.error);
    return { cards: [], lookups: emptyLookups() };
  }

  if (monsterTypesRes.error) console.error('neuron_monster_types', monsterTypesRes.error);
  if (cardFrameTypesRes.error) console.error('neuron_card_frame_types', cardFrameTypesRes.error);
  if (complexFrameTypesRes.error) console.error('neuron_complex_frame_types', complexFrameTypesRes.error);

  return {
    cards: cardsRes.data ?? [],
    lookups: {
      monsterTypes: monsterTypesRes.data ?? [],
      cardFrameTypes: cardFrameTypesRes.data ?? [],
      complexFrameTypes: complexFrameTypesRes.data ?? [],
    },
  };
};

const emptyLookups = () => ({
  monsterTypes: [] as { id: number; name: string | null }[],
  cardFrameTypes: [] as { id: number; name: string }[],
  complexFrameTypes: [] as {
    id: number;
    name: string;
    subtype_1: number | null;
    subtype_2: number | null;
    subtype_3: number | null;
  }[],
});
