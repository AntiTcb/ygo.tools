import 'unplugin-icons/types/svelte';
import type { D1Database } from '@cloudflare/workers-types/index';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './lib/db/database.types';

declare global {
  namespace App {
    interface Platform {
      env: {
        COUNTER: DurableObjectNamespace;
        /** /event-map events and venues. */
        EVENT_MAP_DB: D1Database;
        /** Effect search tagging Workflow (wrangler.effect-tagger.jsonc); params are a RunPlan. */
        EFFECT_TAG_WORKFLOW?: { create(options: { params: unknown }): Promise<{ id: string }> };
        /** Workers AI, for /search query parsing. */
        AI?: import('$lib/effect-search/ai').AiBinding;
        /** Per-IP limit on /search model calls. */
        SEARCH_PARSE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
    // interface Error {}
    interface Locals {
      supabase: SupabaseClient<Database>;
      /** Set by hooks.server.ts on /admin requests: true once the admin session cookie is verified. */
      isAdmin?: boolean;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module '*';

export {};
