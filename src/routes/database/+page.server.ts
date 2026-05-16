import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data, error } = await locals.supabase.from('neuron_cards').select('id,name,effect_text,frame_type_id').eq('language', 'en');

  if (error) {
    console.error('error loading cards from database', error);
    return {
      cards: [],
    };
  }

  console.log('loaded cards from database', data?.length ?? 0);
  return {
    cards: data ?? [],
  };
};
