import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Cloudflare Access protects /admin on the custom domain. The app still verifies the Access JWT
 * itself: Access doesn't cover preview URLs, and the server talks to Supabase with the service-role
 * key, so a missing or invalid token must fail closed.
 */
export type AccessConfig = {
  /** e.g. "ygotools.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) tag of the Access application. */
  aud: string;
};

const keySets = new Map<string, JWTVerifyGetKey>();

const remoteKeys = (teamDomain: string): JWTVerifyGetKey => {
  let keys = keySets.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keys);
  }
  return keys;
};

export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

export const verifyAccessJwt = async (token: string | null, cfg: AccessConfig | null, getKey?: JWTVerifyGetKey): Promise<AccessResult> => {
  if (!cfg?.teamDomain || !cfg.aud) return { ok: false, reason: 'Access is not configured' };
  if (!token) return { ok: false, reason: 'missing Access token' };
  try {
    const { payload } = await jwtVerify(token, getKey ?? remoteKeys(cfg.teamDomain), {
      issuer: `https://${cfg.teamDomain}`,
      audience: cfg.aud,
    });
    if (typeof payload.email !== 'string') return { ok: false, reason: 'token has no email' };
    return { ok: true, email: payload.email };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
};

export const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
