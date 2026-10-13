import { evalRuleNode, type CardFilterRow } from '../db/cardFilterEval';
import type { ComplexFrameTypeRow } from '../db/cardFilterRule';
import { resolveVirtualRuleTree } from '../db/cardFilterResolve';
import { targetToRule, type NameResolver } from './targetRule';
import type { TagAction, TagEffect, TagOutput, TagTrigger, Target } from './tagSchema';

/** 0..1 similarity of two targets (null = unrestricted). */
export type TargetComparer = (a: Target | null, b: Target | null) => number;

/**
 * Compares targets by the cards they actually match across the card pool (Jaccard), so equivalent
 * spellings ("Level 4 or lower" vs "below 5") score as identical.
 */
export const cardPoolTargetComparer = (rows: readonly CardFilterRow[], complexRows: ComplexFrameTypeRow[], resolve: NameResolver): TargetComparer => {
  const cache = new Map<string, Set<number>>();
  const matchSet = (t: Target): Set<number> => {
    const key = JSON.stringify(t);
    let set = cache.get(key);
    if (!set) {
      const rule = resolveVirtualRuleTree(targetToRule(t, resolve).rule, complexRows);
      set = new Set(rows.filter((r) => evalRuleNode(r, rule)).map((r) => r.id));
      cache.set(key, set);
    }
    return set;
  };
  return (a, b) => {
    if (!a && !b) return 1;
    const sa = a ? matchSet(a) : null;
    const sb = b ? matchSet(b) : null;
    // A target that matches every card is the same as no target.
    const all = rows.length;
    if (!sa) return sb!.size === all ? 1 : 0;
    if (!sb) return sa.size === all ? 1 : 0;
    if (sa.size === 0 && sb.size === 0) return 1;
    let inter = 0;
    for (const id of sa) if (sb.has(id)) inter++;
    return inter / (sa.size + sb.size - inter);
  };
};

/** Structural fallback when no card pool is loaded: exact JSON equality. */
export const exactTargetComparer: TargetComparer = (a, b) => (JSON.stringify(a ?? null) === JSON.stringify(b ?? null) ? 1 : 0);

const setEq = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x) => b.includes(x)) && b.every((x) => a.includes(x));

const jaccard = (a: readonly string[], b: readonly string[]) => {
  if (!a.length && !b.length) return 1;
  const inter = a.filter((x) => b.includes(x)).length;
  return inter / new Set([...a, ...b]).size;
};

/** Per-field agreement (1 = same) for a matched pair; the field names feed the error report. */
const actionFields = (e: TagAction, p: TagAction, cmp: TargetComparer): Record<string, number> => ({
  from_zones: jaccard(e.from_zones, p.from_zones),
  to_zones: jaccard(e.to_zones, p.to_zones),
  from_side: Number(e.from_side === p.from_side),
  to_side: Number(e.to_side === p.to_side),
  is_cost: Number(e.is_cost === p.is_cost),
  is_self: Number(e.is_self === p.is_self),
  quantity: Number(e.quantity === p.quantity),
  target: cmp(e.target, p.target),
  name_refs: Number(setEq(e.name_refs, p.name_refs)),
  contextual: Number(e.contextual === p.contextual),
  ...(e.verb === 'change_stats'
    ? { stat: Number(e.stat === p.stat), stat_mode: Number(e.stat_mode === p.stat_mode), stat_amount: Number(e.stat_amount === p.stat_amount) }
    : {}),
});

const triggerFields = (e: TagTrigger, p: TagTrigger, cmp: TargetComparer): Record<string, number> => ({
  subject_is_self: Number(e.subject_is_self === p.subject_is_self),
  subject: cmp(e.subject, p.subject),
  from_zones: jaccard(e.from_zones, p.from_zones),
  subject_side: Number(e.subject_side === p.subject_side),
  cause: Number(e.cause === p.cause),
  cause_side: Number(e.cause_side === p.cause_side),
  cause_card: cmp(e.cause_card, p.cause_card),
});

const effectFields = (e: TagEffect, p: TagEffect): Record<string, number> => ({
  effect_type: Number(e.effect_type === p.effect_type),
  opt: Number(e.opt === p.opt),
  phase_restriction: Number(setEq(e.phase_restriction, p.phase_restriction)),
  turn_restriction: Number(e.turn_restriction === p.turn_restriction),
});

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);

type Matched<T> = { pairs: [T, T, Record<string, number>][]; missed: T[]; extra: T[] };

/** Greedy matching of same-key items (verb/event), best field agreement first. */
const matchByKey = <T>(expected: T[], predicted: T[], key: (x: T) => string, fields: (e: T, p: T) => Record<string, number>): Matched<T> => {
  const candidates: { ei: number; pi: number; f: Record<string, number>; s: number }[] = [];
  expected.forEach((e, ei) =>
    predicted.forEach((p, pi) => {
      if (key(e) !== key(p)) return;
      const f = fields(e, p);
      candidates.push({ ei, pi, f, s: mean(Object.values(f)) });
    }),
  );
  candidates.sort((a, b) => b.s - a.s);
  const usedE = new Set<number>();
  const usedP = new Set<number>();
  const pairs: [T, T, Record<string, number>][] = [];
  for (const c of candidates) {
    if (usedE.has(c.ei) || usedP.has(c.pi)) continue;
    usedE.add(c.ei);
    usedP.add(c.pi);
    pairs.push([expected[c.ei]!, predicted[c.pi]!, c.f]);
  }
  return { pairs, missed: expected.filter((_, i) => !usedE.has(i)), extra: predicted.filter((_, i) => !usedP.has(i)) };
};

const f1 = (matched: number, expected: number, predicted: number) => (expected + predicted === 0 ? 1 : (2 * matched) / (expected + predicted));

export type CardScore = {
  /** Mean of the component scores below that apply to this card. */
  score: number;
  effectsF1: number;
  effectFields: number;
  actionsF1: number;
  actionFields: number;
  triggersF1: number | null;
  triggerFields: number | null;
  unmappedAgreement: number;
  /** field -> number of matched pairs where it disagreed (fractional for zones/targets) */
  fieldErrors: Record<string, number>;
  /** Human-readable mismatches for the report. */
  notes: string[];
};

const effectKey = (e: TagEffect) => `${e.text_source}:${e.effect_index}`;

export const scoreCard = (expected: TagOutput, predicted: TagOutput, cmp: TargetComparer): CardScore => {
  const notes: string[] = [];
  const fieldErrors: Record<string, number> = {};
  const addErrors = (prefix: string, f: Record<string, number>) => {
    for (const [k, v] of Object.entries(f)) if (v < 1) fieldErrors[`${prefix}.${k}`] = (fieldErrors[`${prefix}.${k}`] ?? 0) + (1 - v);
  };

  const predByKey = new Map(predicted.effects.map((e) => [effectKey(e), e]));
  const matchedEffects = expected.effects.flatMap((e) => {
    const p = predByKey.get(effectKey(e));
    return p ? [[e, p] as const] : [];
  });
  if (expected.effects.length !== predicted.effects.length) {
    notes.push(`effects: expected ${expected.effects.length}, got ${predicted.effects.length}`);
  }

  const effFieldScores: number[] = [];
  let actMatched = 0;
  let actExpected = 0;
  let actPredicted = 0;
  const actFieldScores: number[] = [];
  let trgMatched = 0;
  let trgExpected = 0;
  let trgPredicted = 0;
  const trgFieldScores: number[] = [];

  // Actions/triggers of unmatched effects count as missed/extra.
  const matchedKeys = new Set(matchedEffects.map(([e]) => effectKey(e)));
  for (const e of expected.effects) {
    if (matchedKeys.has(effectKey(e))) continue;
    actExpected += e.actions.length;
    trgExpected += e.triggers.length;
  }
  for (const p of predicted.effects) {
    if (matchedKeys.has(effectKey(p))) continue;
    actPredicted += p.actions.length;
    trgPredicted += p.triggers.length;
  }

  for (const [e, p] of matchedEffects) {
    const at = `effect ${effectKey(e)}`;
    const ef = effectFields(e, p);
    addErrors('effect', ef);
    effFieldScores.push(mean(Object.values(ef)));
    for (const [k, v] of Object.entries(ef)) {
      if (v < 1) notes.push(`${at} ${k}: expected ${JSON.stringify(e[k as keyof TagEffect])}, got ${JSON.stringify(p[k as keyof TagEffect])}`);
    }

    const acts = matchByKey(
      e.actions,
      p.actions,
      (a) => a.verb,
      (x, y) => actionFields(x, y, cmp),
    );
    actMatched += acts.pairs.length;
    actExpected += e.actions.length;
    actPredicted += p.actions.length;
    for (const [ea, , f] of acts.pairs) {
      addErrors('action', f);
      actFieldScores.push(mean(Object.values(f)));
      const wrong = Object.entries(f)
        .filter(([, v]) => v < 1)
        .map(([k]) => k);
      if (wrong.length) notes.push(`${at} ${ea.verb}: ${wrong.join(', ')} differ`);
    }
    for (const m of acts.missed) notes.push(`${at}: missing action ${m.verb}`);
    for (const x of acts.extra) notes.push(`${at}: extra action ${x.verb}`);

    const trgs = matchByKey(
      e.triggers,
      p.triggers,
      (t) => t.event,
      (x, y) => triggerFields(x, y, cmp),
    );
    trgMatched += trgs.pairs.length;
    trgExpected += e.triggers.length;
    trgPredicted += p.triggers.length;
    for (const [et, , f] of trgs.pairs) {
      addErrors('trigger', f);
      trgFieldScores.push(mean(Object.values(f)));
      const wrong = Object.entries(f)
        .filter(([, v]) => v < 1)
        .map(([k]) => k);
      if (wrong.length) notes.push(`${at} trigger ${et.event}: ${wrong.join(', ')} differ`);
    }
    for (const m of trgs.missed) notes.push(`${at}: missing trigger ${m.event}`);
    for (const x of trgs.extra) notes.push(`${at}: extra trigger ${x.event}`);
  }

  const effectsF1 = f1(matchedEffects.length, expected.effects.length, predicted.effects.length);
  const actionsF1 = f1(actMatched, actExpected, actPredicted);
  const hasTriggers = trgExpected + trgPredicted > 0;
  const triggersF1 = hasTriggers ? f1(trgMatched, trgExpected, trgPredicted) : null;
  const unmappedAgreement = Number(expected.unmapped.length > 0 === predicted.unmapped.length > 0);
  if (!unmappedAgreement) notes.push(`unmapped: expected ${expected.unmapped.length}, got ${predicted.unmapped.length}`);

  const parts = [effectsF1, mean(effFieldScores), actionsF1, mean(actFieldScores)];
  if (hasTriggers) parts.push(triggersF1!, mean(trgFieldScores));
  return {
    score: mean(parts),
    effectsF1,
    effectFields: mean(effFieldScores),
    actionsF1,
    actionFields: mean(actFieldScores),
    triggersF1,
    triggerFields: hasTriggers ? mean(trgFieldScores) : null,
    unmappedAgreement,
    fieldErrors,
    notes,
  };
};

export type EvalSummary = {
  cards: number;
  failed: number;
  score: number;
  effectsF1: number;
  effectFields: number;
  actionsF1: number;
  actionFields: number;
  triggersF1: number;
  triggerFields: number;
  unmappedAgreement: number;
  /** Most frequent field disagreements across all cards. */
  topFieldErrors: [string, number][];
};

/** Failed tagging attempts (no output) count as score 0. */
export const summarize = (scores: (CardScore | null)[]): EvalSummary => {
  const ok = scores.filter((s): s is CardScore => s !== null);
  const avg = (pick: (s: CardScore) => number | null) => mean(ok.map(pick).filter((x): x is number => x !== null));
  const errors: Record<string, number> = {};
  for (const s of ok) for (const [k, v] of Object.entries(s.fieldErrors)) errors[k] = (errors[k] ?? 0) + v;
  return {
    cards: scores.length,
    failed: scores.length - ok.length,
    score: scores.length ? ok.reduce((a, s) => a + s.score, 0) / scores.length : 0,
    effectsF1: avg((s) => s.effectsF1),
    effectFields: avg((s) => s.effectFields),
    actionsF1: avg((s) => s.actionsF1),
    actionFields: avg((s) => s.actionFields),
    triggersF1: avg((s) => s.triggersF1),
    triggerFields: avg((s) => s.triggerFields),
    unmappedAgreement: avg((s) => s.unmappedAgreement),
    topFieldErrors: Object.entries(errors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, v]) => [k, Math.round(v * 100) / 100]),
  };
};
