import { getRequestEvent, query } from '$app/server';
import { z } from 'zod';

export const searchSbCards = query(z.string(), async (name) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return [];
  }

  const { locals } = getRequestEvent();
  const { data, error } = await locals.supabase.rpc('search_cards', { card_name: trimmed });
  if (error) {
    console.error('error searching for cards', error);
    return [];
  }
  return data ?? [];
});
