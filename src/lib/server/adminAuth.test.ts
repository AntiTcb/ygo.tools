import { describe, expect, it } from 'vitest';
import { adminSessionToken, checkAdminPassword, isAdminPath, isAdminSession, safeAdminRedirect, safeEqual } from './adminAuth';

describe('admin password auth', () => {
  it('accepts only the configured password, and nothing when none is configured', async () => {
    expect(await checkAdminPassword('hunter2', 'hunter2')).toBe(true);
    expect(await checkAdminPassword('hunter3', 'hunter2')).toBe(false);
    expect(await checkAdminPassword('', '')).toBe(false);
    expect(await checkAdminPassword('anything', undefined)).toBe(false);
  });

  it('issues a session cookie that is valid only for the current password', async () => {
    const token = await adminSessionToken('hunter2');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toContain('hunter2');
    expect(await isAdminSession(token, 'hunter2')).toBe(true);
    expect(await isAdminSession(token, 'changed')).toBe(false);
    expect(await isAdminSession(undefined, 'hunter2')).toBe(false);
    expect(await isAdminSession(token, undefined)).toBe(false);
    expect(await isAdminSession('forged', 'hunter2')).toBe(false);
  });

  it('compares strings of different lengths safely', async () => {
    expect(await safeEqual('a', 'a')).toBe(true);
    expect(await safeEqual('a', 'ab')).toBe(false);
  });
});

describe('admin paths', () => {
  it('matches /admin and its subpaths only', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/cards/1')).toBe(true);
    expect(isAdminPath('/administrator')).toBe(false);
  });

  it('only redirects back into /admin after login', () => {
    expect(safeAdminRedirect('/admin/cards/1')).toBe('/admin/cards/1');
    expect(safeAdminRedirect('https://evil.example')).toBe('/admin');
    expect(safeAdminRedirect('//evil.example/admin')).toBe('/admin');
    expect(safeAdminRedirect(null)).toBe('/admin');
  });
});
