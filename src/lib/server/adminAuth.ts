/**
 * Interim /admin auth: one shared password (ADMIN_DASHBOARD_PASS). A correct login sets a cookie
 * holding an HMAC of a fixed label keyed by the password, so changing the password signs everyone
 * out. Fails closed when the password isn't configured: the server talks to Supabase with the
 * service-role key, so /admin must never be open by accident.
 */

export const ADMIN_COOKIE = 'ygo_admin';
export const ADMIN_LOGIN_PATH = '/admin/login';

const encoder = new TextEncoder();

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Cookie value for a given password. */
export const adminSessionToken = async (password: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode('ygo.tools admin session v1')));
};

/** Constant-time string comparison (compares SHA-256 digests so lengths never leak). */
export const safeEqual = async (a: string, b: string): Promise<boolean> => {
  const [da, db] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
};

export const checkAdminPassword = async (attempt: string, password: string | undefined): Promise<boolean> =>
  Boolean(password) && (await safeEqual(attempt, password!));

export const isAdminSession = async (cookie: string | undefined, password: string | undefined): Promise<boolean> =>
  Boolean(password && cookie) && (await safeEqual(cookie!, await adminSessionToken(password!)));

export const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

/** Only same-site /admin paths are valid post-login destinations. */
export const safeAdminRedirect = (target: string | null): string => (target && isAdminPath(target) && !target.startsWith('//') ? target : '/admin');
