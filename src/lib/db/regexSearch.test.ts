import { describe, expect, it } from 'vitest';
import { compileRegex, normalizeRegexFlags, toggleRegexFlag } from './regexSearch';

describe('normalizeRegexFlags', () => {
  it('keeps valid unique flags in order of first appearance', () => {
    expect(normalizeRegexFlags('iims')).toBe('ims');
  });

  it('lowercases and drops unsupported characters', () => {
    expect(normalizeRegexFlags('IxZ1m')).toBe('im');
  });
});

describe('toggleRegexFlag', () => {
  it('adds a missing flag', () => {
    expect(toggleRegexFlag('i', 'm')).toBe('im');
  });

  it('removes an existing flag', () => {
    expect(toggleRegexFlag('im', 'i')).toBe('m');
  });

  it('returns sorted unique flags', () => {
    expect(toggleRegexFlag('mi', 's')).toBe('ims');
  });
});

describe('compileRegex', () => {
  it('compiles a plain pattern with extra flags', () => {
    const r = compileRegex('destroy', 'i');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usedDelimiter).toBe(false);
    expect(r.source).toBe('destroy');
    expect(r.flags).toBe('i');
    expect(r.regex.test('DESTROY')).toBe(true);
  });

  it('parses /pattern/flags delimiter form and ignores extraFlags', () => {
    const r = compileRegex('/negate.*activation/i', 'm');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usedDelimiter).toBe(true);
    expect(r.source).toBe('negate.*activation');
    expect(r.flags).toBe('i');
    expect(r.regex.test('Negate the activation')).toBe(true);
  });

  it('supports alternate delimiters', () => {
    const r = compileRegex('~foo~i', '');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usedDelimiter).toBe(true);
    expect(r.source).toBe('foo');
    expect(r.flags).toBe('i');
  });

  it('returns an error for invalid patterns', () => {
    const r = compileRegex('(', '');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(0);
    expect(r.usedDelimiter).toBe(false);
  });

  it('returns an error for invalid delimiter patterns', () => {
    const r = compileRegex('/(/', '');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.usedDelimiter).toBe(true);
  });
});
