import { supabase } from '$lib/db/supabase';

export const load = async () => {
  const { data } = await supabase.from('neuron_cards').select().limit(100);
  return {
    cards: data ?? [],
  };
};
