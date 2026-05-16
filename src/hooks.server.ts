import { env as secretEnv } from '$env/dynamic/private';
import { env } from '$env/dynamic/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = secretEnv.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  event.locals.supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return event.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        /**
         * Note: You have to add the `path` variable to the
         * set and remove method due to sveltekit's cookie API
         * requiring this to be set, setting the path to an empty string
         * will replicate previous/standard behavior (https://kit.svelte.dev/docs/types#public-types-cookies)
         *
         * Pass through `headers` from @supabase/ssr v0.10+ so token refresh responses are not CDN-cached.
         */
        cookiesToSet.forEach(({ name, value, options }) => event.cookies.set(name, value, { ...options, path: '/' }));
        event.setHeaders(headers);
      },
    },
  });

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};
