import { env } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const supabase = createClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);

export const searchCards = async (cardName: string) => await supabase.rpc('search_cards', { card_name: cardName });
