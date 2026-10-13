import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// hooks.server.ts verifies Cloudflare Access for /admin; this is a second check in case a route is
// ever reached without the hook having set the admin identity.
export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.adminEmail) error(403, 'Forbidden');
  return { adminEmail: locals.adminEmail };
};
