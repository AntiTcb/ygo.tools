import { env as secretEnv } from '$env/dynamic/private';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/db/database.types';
import { ADMIN_COOKIE, ADMIN_LOGIN_PATH, isAdminPath, isAdminSession } from '$lib/server/adminAuth';
import { createServerClient } from '@supabase/ssr';
import { error, redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = secretEnv.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  event.locals.supabase = createServerClient<Database>(supabaseUrl, supabaseServiceKey, {
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

  // Gate here rather than in an /admin layout load: form actions don't run layout loads.
  if (isAdminPath(event.url.pathname) && event.url.pathname !== ADMIN_LOGIN_PATH) {
    event.locals.isAdmin = await isAdminSession(event.cookies.get(ADMIN_COOKIE), secretEnv.ADMIN_DASHBOARD_PASS);
    if (!event.locals.isAdmin) {
      if (event.request.method !== 'GET') error(403, 'Forbidden');
      redirect(303, `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(event.url.pathname + event.url.search)}`);
    }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};
