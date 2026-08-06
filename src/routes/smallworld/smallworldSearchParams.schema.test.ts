import { describe, expect, it } from 'vitest';
import { smallworldSearchParamsSchema } from './smallworldSearchParams.schema';

describe('smallworldSearchParamsSchema', () => {
  it('fills defaults for an empty object', () => {
    const parsed = smallworldSearchParamsSchema.parse({});
    expect(parsed.revealId).toBeNull();
    expect(parsed.bridgeId).toBeNull();
    expect(parsed.targetNameFilter).toBe('');
    expect(parsed.page).toBe(1);
  });

  it('accepts numeric card ids and filter state', () => {
    const parsed = smallworldSearchParamsSchema.parse({
      revealId: 46986414,
      bridgeId: 14558127,
      targetNameFilter: 'Ash',
      page: 2,
    });
    expect(parsed.revealId).toBe(46986414);
    expect(parsed.bridgeId).toBe(14558127);
    expect(parsed.targetNameFilter).toBe('Ash');
    expect(parsed.page).toBe(2);
  });

  it('coerces digit-string card ids from the URL', () => {
    const parsed = smallworldSearchParamsSchema.parse({
      revealId: '46986414',
      bridgeId: '14558127',
    });
    expect(parsed.revealId).toBe(46986414);
    expect(parsed.bridgeId).toBe(14558127);
  });

  it('falls back to null for invalid card ids', () => {
    const parsed = smallworldSearchParamsSchema.parse({
      revealId: 'not-a-number',
      bridgeId: -1,
    });
    expect(parsed.revealId).toBeNull();
    expect(parsed.bridgeId).toBeNull();
  });

  it('falls back to page 1 for invalid page values', () => {
    expect(smallworldSearchParamsSchema.parse({ page: 0 }).page).toBe(1);
    expect(smallworldSearchParamsSchema.parse({ page: 'nope' }).page).toBe(1);
  });
});
