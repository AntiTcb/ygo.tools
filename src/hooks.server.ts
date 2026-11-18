import { ADMIN_DASHBOARD_PASS, SUPABASE_SERVICE_KEY } from '$app/env/private';
import { PUBLIC_SUPABASE_URL } from '$app/env/public';
import type { Database } from '#lib/db/database.types.js';
import { ADMIN_COOKIE, ADMIN_LOGIN_PATH, isAdminPath, isAdminSession } from '#lib/server/adminAuth.js';
import { createServerClient } from '@supabase/ssr';
import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
  const supabaseUrl = PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  event.locals.supabase = createServerClient<Database>(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return event.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Pass through `headers` from @supabase/ssr v0.10+ so token refresh responses are not CDN-cached.
        cookiesToSet.forEach(({ name, value, options }) => event.cookies.set(name, value, options));
        event.setHeaders(headers);
      },
    },
  });

  // Gate here rather than in an /admin layout load: form actions don't run layout loads.
  if (isAdminPath(event.url.pathname) && event.url.pathname !== ADMIN_LOGIN_PATH) {
    event.locals.isAdmin = await isAdminSession(event.cookies.get(ADMIN_COOKIE), ADMIN_DASHBOARD_PASS);
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
