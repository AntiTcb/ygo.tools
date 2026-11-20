import { json } from '@sveltejs/kit';
import { nameList, suggestNames, type NameList } from '#lib/effect-search/nameSuggest.js';
import { getCardPool } from '#lib/effect-search/searchEngine.js';
import type { CardPool } from '#lib/effect-search/db.js';
import { currentCardName } from '#lib/effect-search/store.js';
import type { RequestHandler } from './$types';

// The pool is cached per isolate; build its name list once per pool.
const lists = new WeakMap<CardPool, NameList>();

/** Card-name completions for the /search box: `?q=<request so far>`, or `&whole=1` for a card-name field. */
export const GET: RequestHandler = async ({ locals, url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 300);
  const pool = await getCardPool(locals.supabase);
  let list = lists.get(pool);
  if (!list) {
    list = nameList(pool.cards.map((c) => currentCardName(c.name)));
    lists.set(pool, list);
  }
  return json(suggestNames(list, q, { whole: url.searchParams.has('whole') }), { headers: { 'cache-control': 'public, max-age=300' } });
};
