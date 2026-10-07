import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  SUPABASE_SERVICE_KEY: { schema: (input) => input ?? '' },
  PUBLIC_SUPABASE_URL: { public: true, schema: (input) => input ?? '' },
  PUBLIC_MAPBOX_TOKEN: { public: true, schema: (input) => input ?? '' },
});
