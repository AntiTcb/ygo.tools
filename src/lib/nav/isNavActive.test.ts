import { describe, expect, it } from 'vitest';
import { isNavActive } from './isNavActive';

describe('isNavActive', () => {
  it('matches home only on exact root', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/database', '/')).toBe(false);
  });

  it('matches exact tool paths', () => {
    expect(isNavActive('/smallworld', '/smallworld')).toBe(true);
    expect(isNavActive('/database', '/smallworld')).toBe(false);
  });

  it('matches nested paths under a tool', () => {
    expect(isNavActive('/database/123', '/database')).toBe(true);
  });

  it('does not treat a prefix sibling as active', () => {
    expect(isNavActive('/databases', '/database')).toBe(false);
  });
});
