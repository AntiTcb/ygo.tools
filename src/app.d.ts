import 'unplugin-icons/types/svelte';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './lib/db/database.types';

declare global {
  namespace App {
    interface Platform {
      env: {
        COUNTER: DurableObjectNamespace;
      };
      context: {
        waitUntil(promise: Promise<any>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
    // interface Error {}
    interface Locals {
      supabase: SupabaseClient<Database>;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

declare module '*';

export {};
