import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { ADMIN_COOKIE, adminSessionToken, checkAdminPassword, safeAdminRedirect } from '$lib/server/adminAuth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({ configured: Boolean(env.ADMIN_DASHBOARD_PASS), signedIn: Boolean(locals.isAdmin) });

export const actions: Actions = {
  login: async ({ request, cookies, url }) => {
    const password = env.ADMIN_DASHBOARD_PASS;
    const attempt = String((await request.formData()).get('password') ?? '');
    if (!(await checkAdminPassword(attempt, password))) return fail(401, { wrong: true });
    cookies.set(ADMIN_COOKIE, await adminSessionToken(password!), {
      path: '/admin',
      httpOnly: true,
      secure: !dev,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect(303, safeAdminRedirect(url.searchParams.get('next')));
  },

  logout: ({ cookies }) => {
    cookies.delete(ADMIN_COOKIE, { path: '/admin' });
    redirect(303, '/admin/login');
  },
};
