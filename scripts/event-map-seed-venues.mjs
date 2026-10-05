/* oxlint-disable no-console -- CLI script: progress output is the point. */
// Copies geocoded /event-map venues from the local D1 database to the remote
// (production) one, so production doesn't pay to geocode them again.
//
//   pnpm event-map:seed-venues                          # local -> remote (production)
//   node scripts/event-map-seed-venues.mjs --dry-run   # write the SQL file only
//
// Venue ids are hashes of the normalized address, so the scraper matches these
// rows when it later sees the same venues. Rows the target has already placed
// itself are left alone. Failed venues are copied too (with mapbox_attempted)
// so the target doesn't retry them through the paid Mapbox fallback.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const DATABASE = 'ygo-event-map';
const OUT = '.wrangler/tmp/seed-venues.sql';
const COLUMNS = [
  'id',
  'name',
  'address',
  'city',
  'state',
  'country',
  'lat',
  'lng',
  'geocode_status',
  'geocode_source',
  'geocoded_at',
  'timezone',
  'mapbox_attempted',
];

const dryRun = process.argv.includes('--dry-run');

const pkgPath = createRequire(import.meta.url).resolve('wrangler/package.json');
const { bin } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const wrangler = join(dirname(pkgPath), typeof bin === 'string' ? bin : bin.wrangler);
const run = (args, opts = {}) => execFileSync(process.execPath, [wrangler, ...args], { encoding: 'utf8', ...opts });

const output = run([
  'd1',
  'execute',
  DATABASE,
  '--local',
  '--json',
  '--command',
  `SELECT ${COLUMNS.join(', ')} FROM venues WHERE geocode_status IN ('ok', 'failed')`,
]);
const rows = JSON.parse(output)[0].results;

const sqlValue = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const updates = COLUMNS.filter((c) => c !== 'id')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');
const statements = rows.map(
  (r) =>
    `INSERT INTO venues (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map((c) => sqlValue(r[c])).join(', ')})\n` +
    `ON CONFLICT (id) DO UPDATE SET ${updates} WHERE venues.geocode_status <> 'ok';`,
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${statements.join('\n')}\n`);
const ok = rows.filter((r) => r.geocode_status === 'ok').length;
console.log(`Wrote ${rows.length} venues (${ok} located, ${rows.length - ok} failed) to ${OUT}`);

if (dryRun) process.exit(0);
console.log(`Applying to the remote ${DATABASE} database...`);
run(['d1', 'execute', DATABASE, '--remote', '--file', OUT, '--yes'], { stdio: 'inherit' });
