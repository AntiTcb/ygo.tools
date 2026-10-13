import { z } from 'zod';

/**
 * What the tagger LLM emits for one card. Targets use printed names ("WATER", "Aqua", "xyz") rather
 * than Neuron ids so the model never has to know them; `toRuleNode` (targetRule.ts) converts them.
 * Verb/zone terms are validated against the DB vocabulary separately (the JSON schema sent to the
 * model enumerates them; see tagJsonSchema.ts).
 */

export const ATTRIBUTE_NAMES = ['LIGHT', 'DARK', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE'] as const;

/** Printed monster Types, mapped to `neuron_monster_types` ids. */
export const RACE_IDS = {
  Dragon: 1,
  Zombie: 2,
  Fiend: 3,
  Pyro: 4,
  'Sea Serpent': 5,
  Rock: 6,
  Machine: 7,
  Fish: 8,
  Dinosaur: 9,
  Insect: 10,
  Beast: 11,
  'Beast-Warrior': 12,
  Plant: 13,
  Aqua: 14,
  Warrior: 15,
  'Winged Beast': 16,
  Fairy: 17,
  Spellcaster: 18,
  Thunder: 19,
  Reptile: 20,
  Psychic: 21,
  'Divine-Beast': 22,
  Wyrm: 26,
  Cyberse: 27,
  Illusion: 34,
} as const;

export const RACE_NAMES = Object.keys(RACE_IDS) as [keyof typeof RACE_IDS, ...(keyof typeof RACE_IDS)[]];

/** Monster card kinds, mapped to `neuron_card_frame_types` ids (used via the `frame_subtype` virtual field). */
export const MONSTER_KIND_IDS = {
  normal: 0,
  effect: 1,
  fusion: 2,
  ritual: 3,
  toon: 4,
  spirit: 5,
  union: 6,
  gemini: 7,
  tuner: 8,
  synchro: 9,
  xyz: 10,
  flip: 14,
  pendulum: 15,
  link: 17,
} as const;

export const MONSTER_KINDS = Object.keys(MONSTER_KIND_IDS) as [keyof typeof MONSTER_KIND_IDS, ...(keyof typeof MONSTER_KIND_IDS)[]];

/** Spell/Trap subtypes, mapped to `neuron_cards.effect_id` (see SPELLTRAP_SUBTYPES in cardEnums.ts). */
export const SPELL_TRAP_TYPE_IDS = {
  normal: 0,
  counter: 1,
  field: 2,
  equip: 3,
  continuous: 4,
  quick_play: 5,
  ritual: 6,
} as const;

export const SPELL_TRAP_TYPES = Object.keys(SPELL_TRAP_TYPE_IDS) as [keyof typeof SPELL_TRAP_TYPE_IDS, ...(keyof typeof SPELL_TRAP_TYPE_IDS)[]];

export const CARD_TYPES = ['monster', 'spell', 'trap'] as const;

const numCmpSchema = z.object({
  op: z.enum(['eq', 'neq', 'lt', 'lte', 'gt', 'gte']),
  value: z.number().int(),
});

export type NumCmp = z.infer<typeof numCmpSchema>;

/** A conjunction of constraints: every field present must hold; values inside one list are alternatives. */
export const targetLeafSchema = z.object({
  card_types: z.array(z.enum(CARD_TYPES)).min(1).optional(),
  attributes: z.array(z.enum(ATTRIBUTE_NAMES)).min(1).optional(),
  races: z.array(z.enum(RACE_NAMES)).min(1).optional(),
  monster_kinds: z.array(z.enum(MONSTER_KINDS)).min(1).optional(),
  exclude_monster_kinds: z.array(z.enum(MONSTER_KINDS)).min(1).optional(),
  spell_trap_types: z.array(z.enum(SPELL_TRAP_TYPES)).min(1).optional(),
  /** Level only: implies a non-Xyz, non-Link monster (Neuron stores Rank in the same column). */
  level: numCmpSchema.optional(),
  /** Rank only: implies an Xyz monster. */
  rank: numCmpSchema.optional(),
  link_rating: numCmpSchema.optional(),
  atk: numCmpSchema.optional(),
  def: numCmpSchema.optional(),
  archetypes: z.array(z.string().min(1)).min(1).optional(),
  exclude_archetypes: z.array(z.string().min(1)).min(1).optional(),
  /** Exact printed card names. */
  names: z.array(z.string().min(1)).min(1).optional(),
  exclude_names: z.array(z.string().min(1)).min(1).optional(),
});

export type TargetLeaf = z.infer<typeof targetLeafSchema>;

/** A leaf, optionally AND-ed with a disjunction of leaves ("a 'Frog' monster or a Level 2 Aqua monster"). */
export const targetSchema = targetLeafSchema.extend({
  any_of: z.array(targetLeafSchema).min(2).optional(),
});

export type Target = z.infer<typeof targetSchema>;

const sideSchema = z.enum(['you', 'opponent', 'either']);

export const tagActionSchema = z.object({
  verb: z.string(),
  from_zones: z.array(z.string()).default([]),
  to_zones: z.array(z.string()).default([]),
  from_side: sideSchema.nullable().default(null),
  to_side: sideSchema.nullable().default(null),
  is_cost: z.boolean().default(false),
  is_self: z.boolean().default(false),
  quantity: z.number().int().positive().nullable().default(null),
  /** What the action can apply to; null = unrestricted (or `is_self`). */
  target: targetSchema.nullable().default(null),
  /** Exact quoted card names the action applies to ("Special Summon 1 "Toadally Awesome""). */
  name_refs: z.array(z.string().min(1)).default([]),
  contextual: z.boolean().default(false),
  context_note: z.string().nullable().default(null),
  stat: z.enum(['atk', 'def', 'level', 'rank']).nullable().default(null),
  stat_mode: z.enum(['gain', 'lose', 'set', 'halve', 'double']).nullable().default(null),
  stat_amount: z.number().int().nullable().default(null),
  stat_amount_note: z.string().nullable().default(null),
});

export type TagAction = z.infer<typeof tagActionSchema>;

export const tagTriggerSchema = z.object({
  event: z.string(),
  subject_is_self: z.boolean().default(false),
  subject: targetSchema.nullable().default(null),
  from_zones: z.array(z.string()).default([]),
  subject_side: sideSchema.nullable().default(null),
  cause: z.enum(['cost', 'effect', 'battle', 'material']).nullable().default(null),
  cause_side: sideSchema.nullable().default(null),
  cause_card: targetSchema.nullable().default(null),
});

export type TagTrigger = z.infer<typeof tagTriggerSchema>;

export const tagEffectSchema = z.object({
  text_source: z.enum(['card', 'pendulum']).default('card'),
  /** 0-based position of the effect within its text box. */
  effect_index: z.number().int().min(0),
  snippet: z.string().min(1),
  effect_type: z.enum(['ignition', 'trigger', 'quick', 'continuous', 'activation', 'procedure']),
  opt: z.enum(['none', 'soft', 'hard', 'per_name_activation', 'shared_each_effect']).default('none'),
  phase_restriction: z.array(z.enum(['draw', 'standby', 'main', 'battle', 'damage_step', 'end'])).default([]),
  turn_restriction: z.enum(['any', 'yours', 'opponents']).default('any'),
  triggers: z.array(tagTriggerSchema).default([]),
  actions: z.array(tagActionSchema).default([]),
});

export type TagEffect = z.infer<typeof tagEffectSchema>;

export const tagUnmappedSchema = z.object({
  kind: z.enum(['verb', 'zone']),
  as_action: z.boolean().default(false),
  as_event: z.boolean().default(false),
  proposed_term: z.string().regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().nullable().default(null),
  phrase: z.string().min(1),
});

export type TagUnmapped = z.infer<typeof tagUnmappedSchema>;

export const tagOutputSchema = z.object({
  effects: z.array(tagEffectSchema),
  unmapped: z.array(tagUnmappedSchema).default([]),
});

export type TagOutput = z.infer<typeof tagOutputSchema>;
export type TagOutputInput = z.input<typeof tagOutputSchema>;

export type Vocab = {
  actionVerbs: readonly string[];
  eventVerbs: readonly string[];
  zones: readonly string[];
};

/** Verbs whose actions may carry an amount without a stat (LP and damage). */
export const AMOUNT_VERBS: ReadonlySet<string> = new Set(['inflict_damage', 'gain_lp', 'lose_lp']);

/** Problems the zod schema can't see: terms outside the vocabulary, inconsistent fields. */
export const validateTagOutput = (out: TagOutput, vocab: Vocab): string[] => {
  const errors: string[] = [];
  const actions = new Set(vocab.actionVerbs);
  const events = new Set(vocab.eventVerbs);
  const zones = new Set(vocab.zones);
  const checkZones = (where: string, zs: string[]) => {
    for (const z of zs) if (!zones.has(z)) errors.push(`${where}: unknown zone "${z}"`);
  };
  const seen = new Set<string>();
  for (const [i, e] of out.effects.entries()) {
    const at = `effects[${i}]`;
    const key = `${e.text_source}:${e.effect_index}`;
    if (seen.has(key)) {
      errors.push(
        `${at}: duplicate ${e.text_source} effect_index ${e.effect_index} (effects from the Pendulum Effect text need "text_source": "pendulum" and their own numbering from 0)`,
      );
    }
    seen.add(key);
    for (const [j, t] of e.triggers.entries()) {
      if (!events.has(t.event)) errors.push(`${at}.triggers[${j}]: "${t.event}" is not an event verb`);
      if (t.subject_is_self && t.subject) errors.push(`${at}.triggers[${j}]: subject_is_self with a subject`);
      checkZones(`${at}.triggers[${j}]`, t.from_zones);
    }
    for (const [j, a] of e.actions.entries()) {
      const aat = `${at}.actions[${j}]`;
      if (!actions.has(a.verb)) errors.push(`${aat}: "${a.verb}" is not an action verb`);
      checkZones(aat, [...a.from_zones, ...a.to_zones]);
      if ((a.stat === null) !== (a.stat_mode === null)) errors.push(`${aat}: stat and stat_mode must be set together`);
      if (a.stat === null && !AMOUNT_VERBS.has(a.verb) && (a.stat_amount !== null || a.stat_amount_note !== null)) {
        errors.push(`${aat}: stat_amount is only for change_stats (with stat) and ${[...AMOUNT_VERBS].join('/')}`);
      }
      if (!a.contextual && a.context_note) errors.push(`${aat}: context_note without contextual`);
    }
  }
  return errors;
};

/**
 * Drops fields that carry no information so equivalent outputs compare and store identically:
 * an action on "this card" has no meaningful quantity or source side.
 */
export const normalizeTagOutput = (out: TagOutput): TagOutput => ({
  ...out,
  effects: out.effects.map((e) => ({
    ...e,
    actions: e.actions.map((a) => (a.is_self ? { ...a, quantity: null, from_side: null } : a)),
  })),
});
