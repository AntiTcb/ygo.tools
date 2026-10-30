import 'unplugin-icons/types/svelte';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetaTagsProps } from 'svelte-meta-tags';
import type { Database } from './lib/db/database.types';

// Cloudflare bindings are typed by `pnpm types` (worker-configuration.d.ts) and read from `cloudflare:workers`.
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      supabase: SupabaseClient<Database>;
      /** Set by hooks.server.ts on /admin requests: true once the admin session cookie is verified. */
      isAdmin?: boolean;
    }
    interface PageData {
      /** Page-specific head tags, merged over the root layout's defaults. Set with `definePageMetaTags` in a page load. */
      pageMetaTags?: Readonly<MetaTagsProps>;
    }
    // interface PageState {}
  }
}

declare module '*';

export {};
