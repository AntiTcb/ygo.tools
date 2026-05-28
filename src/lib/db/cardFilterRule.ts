import { z } from 'zod';

/** Complex frame row subset — matches DB load for lookups */
export type ComplexFrameTypeRow = {
  id: number;
  subtype_1: number | null;
  subtype_2: number | null;
  subtype_3: number | null;
};

export const SPELL_FRAME_TYPE_ID = 13;
export const TRAP_FRAME_TYPE_ID = 14;

/** DB value for printed \"?\" ATK/DEF on monsters. */
export const NEURON_ATK_DEF_QUESTION_MARK = -1;

const numFieldSchema = z.enum(['atk', 'def', 'level', 'link_rating', 'pend_scale_l', 'pend_scale_r', 'id']);

const numOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isNull', 'notNull', 'isQuestion', 'notQuestion']);

const catFieldSchema = z.enum(['attribute_id', 'species_id', 'frame_type_id', 'effect_id', 'card_type', 'frame_subtype']);

const catOpSchema = z.enum(['in', 'notIn', 'isNull', 'notNull']);

const bitsOpSchema = z.enum(['eq', 'isNull']);

const textOpSchema = z.enum(['contains', 'eq', 'isNull', 'notNull']);

export const conditionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('num'),
    field: numFieldSchema,
    op: numOpSchema,
    value: z.number().optional(),
  }),
  z.object({
    kind: z.literal('cat'),
    field: catFieldSchema,
    op: catOpSchema,
    values: z.array(z.number()).optional(),
  }),
  z.object({
    kind: z.literal('bits'),
    field: z.literal('link_arrows'),
    op: bitsOpSchema,
    /** Selected directions; combined with `eq` to match raw `link_arrows` exactly (see `encodeLinkArrowsValue`). */
    values: z.array(z.number().int()).optional(),
  }),
  z.object({
    kind: z.literal('text'),
    field: z.literal('pendulum_text'),
    op: textOpSchema,
    value: z.string().optional(),
  }),
]);

export type Condition = z.infer<typeof conditionSchema>;

export type RuleNode = { kind: 'group'; logic: 'and' | 'or'; children: RuleNode[] } | { kind: 'cond'; condition: Condition };

export const ruleNodeSchema: z.ZodType<RuleNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('group'),
      logic: z.enum(['and', 'or']),
      children: z.array(ruleNodeSchema),
    }),
    z.object({
      kind: z.literal('cond'),
      condition: conditionSchema,
    }),
  ]),
);

export const MAX_RULE_DEPTH = 5;
export const MAX_RULE_LEAVES = 50;
export const REMOTE_FETCH_LIMIT = 200;

export const defaultRuleTree = (): RuleNode => ({
  kind: 'group',
  logic: 'and',
  children: [],
});

export const countRuleLeaves = (node: RuleNode): number => {
  if (node.kind === 'cond') return 1;
  return node.children.reduce((acc, ch) => acc + countRuleLeaves(ch), 0);
};

export const maxRuleDepth = (node: RuleNode, depth = 1): number => {
  if (node.kind === 'cond') return depth;
  if (node.children.length === 0) return depth;
  return Math.max(...node.children.map((ch) => maxRuleDepth(ch, depth + 1)));
};

export const validateRuleLimits = (node: RuleNode): { ok: true } | { ok: false; message: string } => {
  if (countRuleLeaves(node) > MAX_RULE_LEAVES) {
    return { ok: false, message: `Too many conditions (max ${MAX_RULE_LEAVES})` };
  }
  if (maxRuleDepth(node) > MAX_RULE_DEPTH) {
    return { ok: false, message: `Nesting too deep (max ${MAX_RULE_DEPTH})` };
  }
  return { ok: true };
};
