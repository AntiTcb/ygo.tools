import { loadVocab } from '$lib/effect-search/db';
import { decodeQuery, describeQuery, encodeQuery, type SearchQuery } from '$lib/effect-search/query';
import { runSearch, textSearch, type SearchResponse } from '$lib/effect-search/searchEngine';
import { parseRequest } from '$lib/server/effectSearch';
import type { PageServerLoad } from './$types';

const MAX_REQUEST_LENGTH = 300;

type Notice = 'rate_limited' | 'unavailable' | 'parse_failed' | 'unsupported' | 'bad_link' | null;

export const load: PageServerLoad = async ({ locals, url, platform, getClientAddress }) => {
  const db = locals.supabase;
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_REQUEST_LENGTH);
  const rawAst = url.searchParams.get('ast');

  // Verb/zone lists for the query chips.
  const vocabPromise = loadVocab(db).then(({ vocab }) => vocab);

  let query: SearchQuery | null = decodeQuery(rawAst);
  let notice: Notice = rawAst && !query ? 'bad_link' : null;
  let unsupportedReason: string | null = null;
  let parsedFresh = false;

  // A link with a valid `ast` replays it without calling the model.
  if (!query && q) {
    const parsed = await parseRequest(db, q, platform?.env, getClientAddress());
    if (!parsed.ok) {
      notice = parsed.error === 'rate_limited' || parsed.error === 'unavailable' ? parsed.error : 'parse_failed';
      if (notice === 'parse_failed') console.error('[search] parse failed', parsed.error);
    } else if ('query' in parsed.reply) {
      query = parsed.reply.query;
      parsedFresh = true;
    } else {
      notice = 'unsupported';
      unsupportedReason = parsed.reply.unsupported;
    }
  }

  let response: SearchResponse | null = null;
  if (query) {
    try {
      response = await runSearch(db, query);
    } catch (e) {
      console.error('[search] query failed', e);
      notice = 'parse_failed';
    }
  }

  // Couldn't express the request as a query: fall back to plain text search.
  const textResults = q && !query && notice !== 'rate_limited' ? await textSearch(db, q).catch(() => []) : [];

  return {
    q,
    query,
    ast: query ? encodeQuery(query) : null,
    description: query ? describeQuery(query) : null,
    /** True when this load called the model; the page then writes `ast` into the URL. */
    parsedFresh,
    response,
    notice,
    unsupportedReason,
    textResults,
    vocab: await vocabPromise,
  };
};
