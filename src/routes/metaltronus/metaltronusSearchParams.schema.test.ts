import { describe, expect, it } from 'vitest';
import { metaltronusSearchParamsSchema } from './metaltronusSearchParams.schema';

describe('metaltronusSearchParamsSchema', () => {
  it('fills defaults for an empty object', () => {
    const parsed = metaltronusSearchParamsSchema.parse({});
    expect(parsed.targetId).toBeNull();
    expect(parsed.resultNameFilter).toBe('');
    expect(parsed.page).toBe(1);
  });

  it('accepts a numeric card id and filter state', () => {
    const parsed = metaltronusSearchParamsSchema.parse({
      targetId: 46986414,
      resultNameFilter: 'Ash',
      page: 2,
    });
    expect(parsed.targetId).toBe(46986414);
    expect(parsed.resultNameFilter).toBe('Ash');
    expect(parsed.page).toBe(2);
  });

  it('coerces a digit-string card id from the URL', () => {
    const parsed = metaltronusSearchParamsSchema.parse({
      targetId: '46986414',
    });
    expect(parsed.targetId).toBe(46986414);
  });

  it('falls back to null for invalid card ids', () => {
    const parsed = metaltronusSearchParamsSchema.parse({
      targetId: 'not-a-number',
    });
    expect(parsed.targetId).toBeNull();
  });

  it('falls back to page 1 for invalid page values', () => {
    expect(metaltronusSearchParamsSchema.parse({ page: 0 }).page).toBe(1);
    expect(metaltronusSearchParamsSchema.parse({ page: 'nope' }).page).toBe(1);
  });
});
