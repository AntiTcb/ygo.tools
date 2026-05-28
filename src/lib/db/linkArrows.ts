/**
 * `neuron_cards.link_arrows` stores link markers as a decimal number: concat digit codes
 * bottom → top, within each row left → right.
 *
 * Rows: bottom [SW=1, S=2, SE=3], middle [W=4, E=6], top [NW=7, N=8, NE=9]. (5 = unused.)
 *
 * Examples: S+N only → 28; SW+SE+NW+NE → 1379.
 */
export const LINK_ARROW_DIGIT = {
  NW: 7,
  N: 8,
  NE: 9,
  W: 4,
  E: 6,
  SW: 1,
  S: 2,
  SE: 3,
} as const;

export type LinkArrowCell = {
  label: string;
  /** Single digit 1–9 (no 5). */
  digit: number;
};

/** Top = far from player; bottom = near. Center cell has no arrow. */
export const LINK_ARROW_GRID: (LinkArrowCell | null)[][] = [
  [
    { label: 'NW', digit: LINK_ARROW_DIGIT.NW },
    { label: 'N', digit: LINK_ARROW_DIGIT.N },
    { label: 'NE', digit: LINK_ARROW_DIGIT.NE },
  ],
  [
    { label: 'W', digit: LINK_ARROW_DIGIT.W },
    null,
    { label: 'E', digit: LINK_ARROW_DIGIT.E },
  ],
  [
    { label: 'SW', digit: LINK_ARROW_DIGIT.SW },
    { label: 'S', digit: LINK_ARROW_DIGIT.S },
    { label: 'SE', digit: LINK_ARROW_DIGIT.SE },
  ],
];

/** Encode an active set of direction digits into the DB `link_arrows` integer (canonical order). */
export const encodeLinkArrowsValue = (digits: Iterable<number>): number => {
  const set = new Set(digits);
  const pieces: number[] = [];
  for (const d of [LINK_ARROW_DIGIT.SW, LINK_ARROW_DIGIT.S, LINK_ARROW_DIGIT.SE]) {
    if (set.has(d)) pieces.push(d);
  }
  for (const d of [LINK_ARROW_DIGIT.W, LINK_ARROW_DIGIT.E]) {
    if (set.has(d)) pieces.push(d);
  }
  for (const d of [LINK_ARROW_DIGIT.NW, LINK_ARROW_DIGIT.N, LINK_ARROW_DIGIT.NE]) {
    if (set.has(d)) pieces.push(d);
  }
  return pieces.length ? Number(pieces.join('')) : 0;
};
