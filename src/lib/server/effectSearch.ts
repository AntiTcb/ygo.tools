import { dev } from '$app/env';
import { AI_GATEWAY_ID, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_API_TOKEN, SEARCH_PARSER_MODEL } from '$app/env/private';
import { isModelKey, MODELS, workersAiBindingClient, workersAiRestClient, type ChatClient, type ModelKey } from '#lib/effect-search/ai.js';
import { loadVocab, type Db } from '#lib/effect-search/db.js';
import {
  buildParserJsonSchema,
  buildParserPrompt,
  parseSearchRequest,
  PARSER_PROMPT_VERSION,
  type ParseResult,
} from '#lib/effect-search/queryParser.js';
import { env } from 'cloudflare:workers';

/** Default /search parser model; override with SEARCH_PARSER_MODEL (a key of MODELS). */
const DEFAULT_PARSER_MODEL: ModelKey = 'kimi-k2.6';

/** Parses are cached by AI Gateway for a day: the same request text gets the same query. */
const GATEWAY_CACHE_SECONDS = 24 * 60 * 60;

/**
 * The model client for query parsing: the Workers AI binding on Cloudflare (through AI Gateway, with
 * caching), or the REST API with a token in local dev. Null when neither is configured.
 */
const parserClient = (): ChatClient | null => {
  // Local dev has no real Workers AI binding (remote bindings are off), so use the REST API there.
  if (env.AI && !dev) return workersAiBindingClient(env.AI, { id: AI_GATEWAY_ID || 'default', cacheTtl: GATEWAY_CACHE_SECONDS });
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_AI_API_TOKEN) {
    return workersAiRestClient({ accountId: CLOUDFLARE_ACCOUNT_ID, apiToken: CLOUDFLARE_AI_API_TOKEN });
  }
  return null;
};

// The vocabulary changes rarely; rebuild the prompt at most every 10 minutes per isolate.
let promptCache: {
  at: number;
  value: Promise<{ systemPrompt: string; jsonSchema: Record<string, unknown>; vocab: Awaited<ReturnType<typeof loadVocab>>['vocab'] }>;
} | null = null;
const PROMPT_TTL_MS = 10 * 60 * 1000;

const parserPrompt = (db: Db) => {
  if (!promptCache || Date.now() - promptCache.at > PROMPT_TTL_MS) {
    const value = loadVocab(db).then(({ prompt, vocab }) => ({
      systemPrompt: buildParserPrompt(prompt),
      jsonSchema: buildParserJsonSchema(vocab),
      vocab,
    }));
    promptCache = { at: Date.now(), value };
    value.catch(() => (promptCache = null));
  }
  return promptCache.value;
};

export type ParseOutcome = ParseResult | { ok: false; error: 'rate_limited' | 'unavailable'; usage: null; ms: 0 };

/** Turns a search request into a query, enforcing the per-IP rate limit on model calls. */
export const parseRequest = async (db: Db, request: string, clientIp: string): Promise<ParseOutcome> => {
  const client = parserClient();
  if (!client) return { ok: false, error: 'unavailable', usage: null, ms: 0 };
  if (env.SEARCH_PARSE_LIMITER) {
    const { success } = await env.SEARCH_PARSE_LIMITER.limit({ key: `parse:${clientIp}` });
    if (!success) return { ok: false, error: 'rate_limited', usage: null, ms: 0 };
  }
  const key = SEARCH_PARSER_MODEL && isModelKey(SEARCH_PARSER_MODEL) ? SEARCH_PARSER_MODEL : DEFAULT_PARSER_MODEL;
  const model = MODELS[key];
  const prompt = await parserPrompt(db);
  return parseSearchRequest(request, {
    client,
    model: model.id,
    // The version rides along in the system prompt so prompt changes don't hit stale gateway cache entries.
    systemPrompt: `${prompt.systemPrompt}\n\n(prompt ${PARSER_PROMPT_VERSION})`,
    jsonSchema: prompt.jsonSchema,
    vocab: prompt.vocab,
    reasoningEffort: model.reasoning ? model.reasoning[0] : undefined,
  });
};
