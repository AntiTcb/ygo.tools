import { z } from 'zod';

/**
 * URL-backed picker state for `/gizmekuka`. Consumed by `useSearchParams` in
 * `+page.svelte` so the selected monster (and result filter/pages) are shareable.
 *
 * Card ids default to `null`, so Runed does not treat them as number fields and
 * leaves URL values as strings — accept both numbers and digit strings.
 */
const cardIdParam = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number), z.null()])
  .catch(null);

const pageParam = z.number().int().positive().catch(1).default(1);

export const gizmekukaSearchParamsSchema = z.object({
  monsterId: cardIdParam,
  resultNameFilter: z.string().default(''),
  summonPage: pageParam,
  targetPage: pageParam,
});

export type GizmekukaSearchParams = z.infer<typeof gizmekukaSearchParamsSchema>;
