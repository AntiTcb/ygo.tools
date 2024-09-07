import { searchCards} from '$lib/db/supabase';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
    if (!url.searchParams.get('name')) {
        error(401, 'No name provided');
    }

    const cards = await searchCards(url.searchParams.get('name')!);

    return json(cards.data?.map((c => c.name)) ?? []);
}
