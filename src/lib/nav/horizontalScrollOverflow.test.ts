import { describe, expect, it } from 'vitest';
import { getHorizontalScrollOverflow } from './horizontalScrollOverflow';

describe('getHorizontalScrollOverflow', () => {
  it('reports no overflow when content fits', () => {
    expect(getHorizontalScrollOverflow(0, 400, 400)).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it('reports right overflow at the start of a wider list', () => {
    expect(getHorizontalScrollOverflow(0, 400, 600)).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  it('reports left overflow when scrolled away from the start', () => {
    expect(getHorizontalScrollOverflow(50, 400, 600)).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });

  it('reports only left overflow at the end', () => {
    expect(getHorizontalScrollOverflow(200, 400, 600)).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it('ignores sub-pixel remainder within epsilon', () => {
    expect(getHorizontalScrollOverflow(0.25, 400, 400.5)).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });
});
