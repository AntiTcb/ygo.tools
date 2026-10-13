import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { isAdminPath, verifyAccessJwt } from './access';

const cfg = { teamDomain: 'team.cloudflareaccess.com', aud: 'aud-tag' };

const setup = async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; aud?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(opts.iss ?? `https://${cfg.teamDomain}`)
      .setAudience(opts.aud ?? cfg.aud)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '5m')
      .sign(privateKey);
  return { keys, sign };
};

describe('verifyAccessJwt', () => {
  it('accepts a valid token and returns the email', async () => {
    const { keys, sign } = await setup();
    expect(await verifyAccessJwt(await sign({ email: 'a@b.c' }), cfg, keys)).toEqual({ ok: true, email: 'a@b.c' });
  });

  it('fails closed on missing config, missing token, wrong audience/issuer, expiry or no email', async () => {
    const { keys, sign } = await setup();
    const good = await sign({ email: 'a@b.c' });
    expect(await verifyAccessJwt(good, null, keys)).toMatchObject({ ok: false, reason: 'Access is not configured' });
    expect(await verifyAccessJwt(good, { ...cfg, aud: '' }, keys)).toMatchObject({ ok: false });
    expect(await verifyAccessJwt(null, cfg, keys)).toMatchObject({ ok: false, reason: 'missing Access token' });
    expect(await verifyAccessJwt(await sign({ email: 'a@b.c' }, { aud: 'other' }), cfg, keys)).toMatchObject({ ok: false });
    expect(await verifyAccessJwt(await sign({ email: 'a@b.c' }, { iss: 'https://evil.example' }), cfg, keys)).toMatchObject({ ok: false });
    expect(await verifyAccessJwt(await sign({ email: 'a@b.c' }, { exp: '-1m' }), cfg, keys)).toMatchObject({ ok: false });
    expect(await verifyAccessJwt(await sign({}), cfg, keys)).toMatchObject({ ok: false, reason: 'token has no email' });
  });

  it('rejects tokens signed by another key', async () => {
    const { keys } = await setup();
    const other = await setup();
    expect(await verifyAccessJwt(await other.sign({ email: 'a@b.c' }), cfg, keys)).toMatchObject({ ok: false });
  });
});

describe('isAdminPath', () => {
  it('matches /admin and its subpaths only', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/cards/1')).toBe(true);
    expect(isAdminPath('/administrator')).toBe(false);
    expect(isAdminPath('/search')).toBe(false);
  });
});
