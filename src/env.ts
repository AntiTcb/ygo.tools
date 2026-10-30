import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional: unset reads as `undefined`, and callers decide whether that's an error. */
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
  SUPABASE_SERVICE_KEY: { schema: optional, description: 'Supabase service role key; hooks.server.ts throws when unset.' },
  ADMIN_DASHBOARD_PASS: { schema: optional, description: 'Shared /admin password (unset = dashboard disabled).' },
  PUBLIC_SUPABASE_URL: { public: true, schema: optional },
  PUBLIC_MAPBOX_TOKEN: { public: true, schema: optional, description: 'Public Mapbox token (pk.*) for /event-map.' },
});
