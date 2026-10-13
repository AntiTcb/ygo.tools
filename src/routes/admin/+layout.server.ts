import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// hooks.server.ts gates /admin (including form actions, which layout loads don't cover); this is a
// second check in case a page is ever reached without the hook having verified the session.
export const load: LayoutServerLoad = ({ locals, url }) => {
  if (url.pathname !== '/admin/login' && !locals.isAdmin) error(403, 'Forbidden');
  return {};
};
