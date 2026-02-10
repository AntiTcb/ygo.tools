import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data } = await locals.supabase.from('neuron_cards').select('id,name,effect_text,frame_type_id').eq('language', 'en');
  return {
    cards: data ?? [],
  };
};
