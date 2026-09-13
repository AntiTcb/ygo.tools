import { describe, expect, it } from 'vitest';
import { gizmekukaSearchParamsSchema } from './gizmekukaSearchParams.schema';

describe('gizmekukaSearchParamsSchema', () => {
  it('fills defaults for an empty object', () => {
    const parsed = gizmekukaSearchParamsSchema.parse({});
    expect(parsed.monsterId).toBeNull();
    expect(parsed.resultNameFilter).toBe('');
    expect(parsed.summonPage).toBe(1);
    expect(parsed.targetPage).toBe(1);
  });

  it('accepts a numeric card id and filter state', () => {
    const parsed = gizmekukaSearchParamsSchema.parse({
      monsterId: 15017,
      resultNameFilter: 'Ash',
      summonPage: 2,
      targetPage: 3,
    });
    expect(parsed.monsterId).toBe(15017);
    expect(parsed.resultNameFilter).toBe('Ash');
    expect(parsed.summonPage).toBe(2);
    expect(parsed.targetPage).toBe(3);
  });

  it('coerces a digit-string card id from the URL', () => {
    const parsed = gizmekukaSearchParamsSchema.parse({
      monsterId: '15017',
    });
    expect(parsed.monsterId).toBe(15017);
  });

  it('falls back to null for invalid card ids', () => {
    const parsed = gizmekukaSearchParamsSchema.parse({
      monsterId: 'not-a-number',
    });
    expect(parsed.monsterId).toBeNull();
  });

  it('falls back to page 1 for invalid page values', () => {
    expect(gizmekukaSearchParamsSchema.parse({ summonPage: 0 }).summonPage).toBe(1);
    expect(gizmekukaSearchParamsSchema.parse({ targetPage: 'nope' }).targetPage).toBe(1);
  });
});
