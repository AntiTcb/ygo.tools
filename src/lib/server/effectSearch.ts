import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
  isModelKey,
  MODELS,
  workersAiBindingClient,
  workersAiRestClient,
  type AiBinding,
  type ChatClient,
  type ModelKey,
} from '$lib/effect-search/ai';
import { loadVocab, type Db } from '$lib/effect-search/db';
import {
  buildParserJsonSchema,
  buildParserPrompt,
  parseSearchRequest,
  PARSER_PROMPT_VERSION,
  type ParseResult,
} from '$lib/effect-search/queryParser';

/** Default /search parser model; override with SEARCH_PARSER_MODEL (a key of MODELS). */
const DEFAULT_PARSER_MODEL: ModelKey = 'kimi-k2.6';

/** Parses are cached by AI Gateway for a day: the same request text gets the same query. */
const GATEWAY_CACHE_SECONDS = 24 * 60 * 60;

export type SearchPlatformEnv = {
  AI?: AiBinding;
  SEARCH_PARSE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
};

/**
 * The model client for query parsing: the Workers AI binding on Cloudflare (through AI Gateway, with
 * caching), or the REST API with a token in local dev. Null when neither is configured.
 */
const parserClient = (platformEnv: SearchPlatformEnv | undefined): ChatClient | null => {
  // Local dev has no real Workers AI binding (remote bindings are off), so use the REST API there.
  if (platformEnv?.AI && !dev) return workersAiBindingClient(platformEnv.AI, { id: env.AI_GATEWAY_ID || 'default', cacheTtl: GATEWAY_CACHE_SECONDS });
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_AI_API_TOKEN) {
    return workersAiRestClient({ accountId: env.CLOUDFLARE_ACCOUNT_ID, apiToken: env.CLOUDFLARE_AI_API_TOKEN });
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
export const parseRequest = async (db: Db, request: string, platformEnv: SearchPlatformEnv | undefined, clientIp: string): Promise<ParseOutcome> => {
  const client = parserClient(platformEnv);
  if (!client) return { ok: false, error: 'unavailable', usage: null, ms: 0 };
  if (platformEnv?.SEARCH_PARSE_LIMITER) {
    const { success } = await platformEnv.SEARCH_PARSE_LIMITER.limit({ key: `parse:${clientIp}` });
    if (!success) return { ok: false, error: 'rate_limited', usage: null, ms: 0 };
  }
  const key = env.SEARCH_PARSER_MODEL && isModelKey(env.SEARCH_PARSER_MODEL) ? env.SEARCH_PARSER_MODEL : DEFAULT_PARSER_MODEL;
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
