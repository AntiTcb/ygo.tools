import { getRequestEvent, query } from '$app/server';
import { z } from 'zod';

export const searchSbCards = query(z.string(), async (name) => {
  const { locals } = await getRequestEvent();

  const { data } = await locals.supabase.rpc('search_cards', { card_name: name });
  return data ?? [];
});
