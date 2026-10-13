/* oxlint-disable no-console -- CLI helpers. */
// Shared setup for the effect-search scripts (run with tsx; env from .env.local via dotenv-cli).
//
// Env: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, and for model calls CLOUDFLARE_ACCOUNT_ID +
// CLOUDFLARE_AI_API_TOKEN (Account > Workers AI > Read + Edit). Optional CLOUDFLARE_AI_GATEWAY_ID.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import type { Database } from '../../src/lib/db/database.types';
import { isModelKey, MODELS, workersAiRestClient, type ModelKey } from '../../src/lib/effect-search/ai';
import { cardTextHashInput } from '../../src/lib/effect-search/store';
import type { Db } from '../../src/lib/effect-search/db';
import { loadVocab } from '../../src/lib/effect-search/db';
import { buildSystemPrompt, TAG_PROMPT_VERSION } from '../../src/lib/effect-search/prompt';
import { buildTagJsonSchema } from '../../src/lib/effect-search/tagJsonSchema';
import type { TaggerConfig } from '../../src/lib/effect-search/tagger';

export const env = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name} (expected in .env.local)`);
    process.exit(1);
  }
  return v;
};

export const supabase = (): Db =>
  createClient<Database>(env('PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } });

export const args = <T extends NonNullable<ParseArgsConfig['options']>>(options: T) => parseArgs({ options, allowPositionals: true, strict: true });

/** md5 of a card's text, as computed by the `effect_tag_queue` view. */
export const textHash = (effectText: string | null, pendulumText: string | null) =>
  createHash('md5').update(cardTextHashInput(effectText, pendulumText)).digest('hex');

export const parseModel = (key: string): ModelKey => {
  if (!isModelKey(key)) {
    console.error(`Unknown model "${key}". Known: ${Object.keys(MODELS).join(', ')}`);
    process.exit(1);
  }
  return key;
};

export const parseReasoning = (v: string | undefined): 'none' | 'high' | undefined => {
  if (v === undefined) return undefined;
  if (v !== 'none' && v !== 'high') {
    console.error('--reasoning must be none or high');
    process.exit(1);
  }
  return v;
};

/** Everything `tagCard` needs, built from the live vocabulary. */
export const taggerConfig = async (
  db: Db,
  model: ModelKey,
  reasoning: 'none' | 'high' | undefined,
): Promise<Omit<TaggerConfig, 'client'> & { promptVersion: string }> => {
  const { prompt, vocab } = await loadVocab(db);
  const info = MODELS[model];
  return {
    model: info.id,
    systemPrompt: buildSystemPrompt(prompt),
    jsonSchema: buildTagJsonSchema(vocab),
    vocab,
    reasoningEffort: info.reasoning ? (reasoning ?? 'none') : undefined,
    promptVersion: TAG_PROMPT_VERSION,
  };
};

export const aiClient = () =>
  workersAiRestClient({
    accountId: env('CLOUDFLARE_ACCOUNT_ID'),
    apiToken: env('CLOUDFLARE_AI_API_TOKEN'),
    gatewayId: process.env.CLOUDFLARE_AI_GATEWAY_ID,
  });

/** Runs `fn` over items with at most `limit` in flight, preserving order. */
export const mapPool = async <T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> => {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

const REPORT_DIR = '.effect-search';

/** Writes a JSON report under .effect-search/ (gitignored) and returns its path. */
export const writeReport = (name: string, data: unknown): string => {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = `${REPORT_DIR}/${name}-${new Date().toISOString().replaceAll(':', '-').slice(0, 19)}.json`;
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
};

export const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
