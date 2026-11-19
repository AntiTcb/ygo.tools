import type { TagAction, TagEffect, Target, TargetLeaf } from './tagSchema';

/**
 * Deterministic fixes for slips the tagger keeps making, applied after the snippet repair (they read the
 * printed effect text). Each fix only removes a contradiction or fills in what the text states outright.
 */

// ---------------------------------------------------------------------------
// "Level 4 or lower" tagged as Level AND Rank AND Link: no card has both, so the target matched nothing.
// ---------------------------------------------------------------------------

type StatKey = 'level' | 'rank' | 'link_rating';
const STAT_KEYS: StatKey[] = ['level', 'rank', 'link_rating'];

const statCount = (l: TargetLeaf) => STAT_KEYS.filter((k) => l[k]).length;

/** Keeps only the stats the text names: "Level 4 or lower" -> level; "Rank" or "Link" only when printed. */
const printedStats = (l: TargetLeaf, text: string): StatKey[] => {
  const named = STAT_KEYS.filter((k) => l[k] && (k === 'level' ? /\bLevel\b/i : k === 'rank' ? /\bRank\b/i : /\bLink[- ]?(Rating|\d)/i).test(text));
  // Nothing recognizable printed: Level is the usual one (and the safest guess).
  return named.length ? named : l.level ? ['level'] : STAT_KEYS.filter((k) => l[k]).slice(0, 1);
};

const fixStatLeaf = (l: TargetLeaf, text: string, canSplit: boolean): Target => {
  if (statCount(l) < 2) return l;
  const keep = printedStats(l, text);
  const rest = { ...l };
  for (const k of STAT_KEYS) delete rest[k];
  if (keep.length === 1) return { ...rest, [keep[0]!]: l[keep[0]!] };
  // "Level/Rank 4 or lower": either one.
  if (canSplit) return { ...rest, any_of: keep.map((k) => ({ [k]: l[k] })) };
  return { ...rest, [keep[0]!]: l[keep[0]!] };
};

// ---------------------------------------------------------------------------
// Repeated alternatives ("Warrior" or "Warrior").
// ---------------------------------------------------------------------------

const dedupeAnyOf = (t: Target): Target => {
  if (!t.any_of) return t;
  const unique = [...new Map(t.any_of.map((a) => [JSON.stringify(a), a])).values()];
  if (unique.length >= 2) return unique.length === t.any_of.length ? t : { ...t, any_of: unique };
  const { any_of: _, ...leaf } = t;
  // One alternative left: it is just another condition.
  return unique[0] ? { ...unique[0], ...leaf } : leaf;
};

export const fixTarget = (t: Target | null, text: string): Target | null => {
  if (!t) return t;
  let out = dedupeAnyOf(t);
  if (out.any_of) out = { ...out, any_of: out.any_of.map((a) => fixStatLeaf(a, text, false) as TargetLeaf) };
  const { any_of, ...leaf } = out;
  const fixedLeaf = fixStatLeaf(leaf, text, !any_of);
  const fixed = dedupeAnyOf(any_of ? { ...fixedLeaf, any_of } : fixedLeaf);
  // Same object back when nothing changed (key order aside), so callers can tell.
  return canonical(fixed) === canonical(t) ? t : fixed;
};

const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

// ---------------------------------------------------------------------------
// "Special Summon this card (from your hand)" tagged without the zone.
// ---------------------------------------------------------------------------

const ZONE_WORDS: [RegExp, string][] = [
  [/^(face-up )?extra deck$/i, 'extra_deck'],
  [/^hand$/i, 'hand'],
  [/^(gy|graveyard)$/i, 'gy'],
  [/^deck$/i, 'deck'],
  [/^banishment$/i, 'banished'],
];

/** Zones in the effect's one "(from your hand or GY)" aside, or null when there isn't exactly one. */
export const summonFromZones = (text: string): string[] | null => {
  const asides = [...text.matchAll(/\(from (?:your |the )?([^)]+)\)/gi)];
  if (asides.length !== 1) return null;
  const words = asides[0]![1]!.split(/,\s*(?:or\s+)?|\s+or\s+/).map((w) => w.trim().replace(/^(your|the)\s+/i, ''));
  const zones = words.map((w) => ZONE_WORDS.find(([re]) => re.test(w))?.[1]);
  return zones.every(Boolean) ? [...new Set(zones as string[])] : null;
};

const fixAction = (a: TagAction, text: string): TagAction => {
  const target = fixTarget(a.target, text);
  let out = target === a.target ? a : { ...a, target };
  if (a.verb === 'special_summon' && a.is_self && !a.from_zones.length) {
    const zones = summonFromZones(text);
    if (zones) out = { ...out, from_zones: zones };
  }
  return out;
};

export const fixTagEffects = <E extends Pick<TagEffect, 'snippet' | 'actions' | 'triggers'>>(effects: E[]): E[] =>
  effects.map((e) => {
    const actions = e.actions.map((a) => fixAction(a, e.snippet));
    const triggers = e.triggers.map((t) => {
      const subject = fixTarget(t.subject, e.snippet);
      const cause_card = fixTarget(t.cause_card, e.snippet);
      return subject === t.subject && cause_card === t.cause_card ? t : { ...t, subject, cause_card };
    });
    return actions.every((a, i) => a === e.actions[i]) && triggers.every((t, i) => t === e.triggers[i]) ? e : { ...e, actions, triggers };
  });
