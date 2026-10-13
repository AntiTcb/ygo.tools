import type { RuleNode } from '../db/cardFilterRule';
import { targetToRule, type NameResolver } from './targetRule';
import type { TagOutput, Target } from './tagSchema';

/** Neuron appends "(Updated from: <old name>)" to renamed cards; card text quotes the current name. */
export const currentCardName = (name: string): string => name.replace(/\s*\(Updated from: .*\)$/, '');

/** Exact-name lookup over English cards (case-insensitive fallback). */
export const buildNameIndex = (cards: readonly { id: number; name: string }[]) => {
  const exact = new Map<string, number[]>();
  const folded = new Map<string, number[]>();
  for (const c of cards) {
    const name = currentCardName(c.name);
    exact.set(name, [...(exact.get(name) ?? []), c.id]);
    const key = name.toLowerCase();
    folded.set(key, [...(folded.get(key) ?? []), c.id]);
  }
  return { exact, folded };
};

export type NameIndex = ReturnType<typeof buildNameIndex>;

/**
 * Resolves quoted names for one referencing card. When several cards share a name, prefer one that
 * Konami lists as related to the referencing card (`neuron_card_relations`).
 */
export const makeNameResolver =
  (index: NameIndex, relatedIds: ReadonlySet<number> = new Set()): NameResolver =>
  (name) => {
    const ids = index.exact.get(name) ?? index.folded.get(name.toLowerCase());
    if (!ids?.length) return undefined;
    return ids.find((id) => relatedIds.has(id)) ?? ids[0];
  };

export type StoredAction = {
  verb: string;
  from_zones: string[];
  to_zones: string[];
  from_side: string | null;
  to_side: string | null;
  is_cost: boolean;
  is_self: boolean;
  quantity: number | null;
  target: Target | null;
  target_rule: RuleNode | null;
  name_refs: number[];
  unresolved_name_refs: string[];
  contextual: boolean;
  context_note: string | null;
  stat: string | null;
  stat_mode: string | null;
  stat_amount: number | null;
  stat_amount_note: string | null;
};

export type StoredTrigger = {
  event: string;
  subject_is_self: boolean;
  subject: Target | null;
  subject_rule: RuleNode | null;
  from_zones: string[];
  subject_side: string | null;
  cause: string | null;
  cause_side: string | null;
  cause_card: Target | null;
  cause_card_rule: RuleNode | null;
};

export type StoredEffect = {
  text_source: string;
  effect_index: number;
  effect_type: string;
  opt: string;
  phase_restriction: string[];
  turn_restriction: string;
  snippet: string;
  actions: StoredAction[];
  triggers: StoredTrigger[];
};

/** The `p_rows` argument of `effect_store_card_tags`: tagger output with targets compiled and names resolved. */
export const projectTagOutput = (out: TagOutput, resolve: NameResolver): StoredEffect[] => {
  const compile = (t: Target | null, unresolved: Set<string>): RuleNode | null => {
    if (!t) return null;
    const { rule, unresolvedNames } = targetToRule(t, resolve);
    unresolvedNames.forEach((n) => unresolved.add(n));
    return rule;
  };

  return out.effects.map((e) => ({
    text_source: e.text_source,
    effect_index: e.effect_index,
    effect_type: e.effect_type,
    opt: e.opt,
    phase_restriction: e.phase_restriction,
    turn_restriction: e.turn_restriction,
    snippet: e.snippet,
    actions: e.actions.map((a) => {
      const unresolved = new Set<string>();
      const target_rule = compile(a.target, unresolved);
      const name_refs = a.name_refs.flatMap((n) => {
        const id = resolve(n);
        if (id === undefined) unresolved.add(n);
        return id === undefined ? [] : [id];
      });
      return {
        verb: a.verb,
        from_zones: a.from_zones,
        to_zones: a.to_zones,
        from_side: a.from_side,
        to_side: a.to_side,
        is_cost: a.is_cost,
        is_self: a.is_self,
        quantity: a.quantity,
        target: a.target,
        target_rule,
        name_refs: [...new Set(name_refs)],
        unresolved_name_refs: [...unresolved],
        contextual: a.contextual,
        context_note: a.context_note,
        stat: a.stat,
        stat_mode: a.stat_mode,
        stat_amount: a.stat_amount,
        stat_amount_note: a.stat_amount_note,
      };
    }),
    triggers: e.triggers.map((t) => {
      const ignored = new Set<string>();
      return {
        event: t.event,
        subject_is_self: t.subject_is_self,
        subject: t.subject,
        subject_rule: compile(t.subject, ignored),
        from_zones: t.from_zones,
        subject_side: t.subject_side,
        cause: t.cause,
        cause_side: t.cause_side,
        cause_card: t.cause_card,
        cause_card_rule: compile(t.cause_card, ignored),
      };
    }),
  }));
};

/** md5(effect_text || U+001F || pendulum_text), matching the `effect_tag_queue` view. */
export const cardTextHashInput = (effectText: string | null, pendulumText: string | null): string => `${effectText ?? ''}\u001f${pendulumText ?? ''}`;
