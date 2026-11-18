import type { D1Database } from '@cloudflare/workers-types/index';
import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';

/** The /event-map D1 database, or a 503 when the binding is missing (e.g. misconfigured env). */
export const eventMapDb = (): D1Database => {
  const db = env.EVENT_MAP_DB;
  if (!db) error(503, 'The event map database is not available.');
  return db;
};
