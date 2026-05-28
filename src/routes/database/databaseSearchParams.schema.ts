import { defaultRuleTree, ruleNodeSchema } from '$lib/db/cardFilterRule';
import { z } from 'zod';

/**
 * URL-backed search state for `/database`. Consumed by `useSearchParams` in
 * `+page.svelte`; every form control on the page binds to one of these keys
 * so the entire search is shareable via a single URL.
 *
 * Runed pre-parses `"true"`/`"false"` to booleans and JSON-decodes `{…}` /
 * `[…]` payloads before handing values to this schema, so plain Zod types
 * are sufficient — no `coerce` wrappers required.
 */
export const databaseSearchParamsSchema = z.object({
  name: z.string().default(''),
  effectText: z.string().default(''),
  pendulumText: z.string().default(''),
  regexEffectSearch: z.boolean().default(false),
  regexPendulumSearch: z.boolean().default(false),
  regexEffectFlags: z.string().default(''),
  regexPendulumFlags: z.string().default(''),
  hideEffectText: z.boolean().default(false),
  ruleDraft: ruleNodeSchema.default(defaultRuleTree()),
  ruleApplied: ruleNodeSchema.default(defaultRuleTree()),
});

export type DatabaseSearchParams = z.infer<typeof databaseSearchParamsSchema>;
