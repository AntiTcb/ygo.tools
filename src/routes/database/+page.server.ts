import { supabase } from '$lib/db/supabase';

export const load = async () => {
  const { data } = await supabase.from('neuron_cards').select('id,name,effect_text,frame_type_id').eq('language', 'en');
  return {
    cards: data ?? [],
  };
};
