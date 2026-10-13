/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Regenerates src/lib/db/database.types.ts from the live Supabase `public` schema.
//
//   pnpm db:types
//
// Uses the self-hosted Supabase's postgres-meta typegen endpoint over HTTPS (/pg/generators/typescript),
// so it doesn't need Docker or a direct Postgres connection. Needs PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_KEY (loaded from .env.local by the pnpm script).
import { writeFileSync } from 'node:fs';
import { formatFiles } from './lib/oxfmt.mjs';

const OUT = 'src/lib/db/database.types.ts';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const res = await fetch(`${url}/pg/generators/typescript?included_schemas=public`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(60_000),
});
const body = await res.text();
if (!res.ok || !body.startsWith('export type Json')) {
  console.error(`Type generation failed: ${res.status}\n${body.slice(0, 500)}`);
  process.exit(1);
}

writeFileSync(OUT, body);
formatFiles(OUT);
console.log(`Wrote ${OUT}`);
