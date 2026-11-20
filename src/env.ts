import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional: unset reads as `undefined`, and callers decide whether that's an error. */
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
  SUPABASE_SERVICE_KEY: { schema: optional, description: 'Supabase service role key; hooks.server.ts throws when unset.' },
  ADMIN_DASHBOARD_PASS: { schema: optional, description: 'Shared /admin password (unset = dashboard disabled).' },
  SEARCH_PARSER_MODEL: { schema: optional, description: '/search query parser model, a key of MODELS in effect-search/ai.ts (default glm-5.3).' },
  AI_GATEWAY_ID: { schema: optional, description: 'AI Gateway for /search model calls (default "default").' },
  CLOUDFLARE_ACCOUNT_ID: {
    schema: optional,
    description: 'Local dev only: Workers AI REST API account for /search, used instead of the AI binding.',
  },
  CLOUDFLARE_AI_API_TOKEN: { schema: optional, description: 'Local dev only: Workers AI REST API token for /search.' },
  PUBLIC_SUPABASE_URL: { public: true, schema: optional },
  PUBLIC_MAPBOX_TOKEN: { public: true, schema: optional, description: 'Public Mapbox token (pk.*) for /event-map.' },
});
