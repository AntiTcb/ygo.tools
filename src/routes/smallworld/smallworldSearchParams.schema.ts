import { z } from 'zod';

/**
 * URL-backed picker state for `/smallworld`. Consumed by `useSearchParams` in
 * `+page.svelte` so reveal/bridge selections (and target filter/page) are shareable.
 *
 * Card ids default to `null`, so Runed does not treat them as number fields and
 * leaves URL values as strings — accept both numbers and digit strings.
 */
const cardIdParam = z
  .union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number), z.null()])
  .catch(null);

export const smallworldSearchParamsSchema = z.object({
  revealId: cardIdParam,
  bridgeId: cardIdParam,
  targetNameFilter: z.string().default(''),
  page: z.number().int().positive().catch(1).default(1),
});

export type SmallworldSearchParams = z.infer<typeof smallworldSearchParamsSchema>;
