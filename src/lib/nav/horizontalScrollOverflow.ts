export type HorizontalScrollOverflow = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

/** Derive edge overflow from a horizontal scroll container's metrics. */
export const getHorizontalScrollOverflow = (
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  epsilon = 1,
): HorizontalScrollOverflow => ({
  canScrollLeft: scrollLeft > epsilon,
  canScrollRight: scrollLeft + clientWidth < scrollWidth - epsilon,
});
