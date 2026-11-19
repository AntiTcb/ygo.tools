import type { TagAction, TagEffect, Target, TargetLeaf } from './tagSchema';

/**
 * Finds target restrictions that aren't where the action is:
 * - other_effect: printed on the card, but not in this effect (it leaked in from another effect, e.g. the
 *   "Snake-Eye" of a card's GY effect showing up in its Special Summon effect);
 * - other_clause: printed in the effect, but not in the clause that performs the action ("target 1
 *   "Snake-Eye" monster in your GY; add 1 Level 1 FIRE monster" tagging the add as a "Snake-Eye" monster).
 *   The loosest check, with some false positives;
 * - unprinted: nowhere on the card (made up, or a paraphrase the check can't read).
 * Lists naming (nearly) every possible value ("any Spell" spelled out as all six Spell types) aren't checked.
 */

export const LEAK_KINDS = ['other_effect', 'other_clause', 'unprinted'] as const;
export type LeakKind = (typeof LEAK_KINDS)[number];

export type Leak = {
  kind: LeakKind;
  effectIndex: number;
  textSource: string;
  /** "action 1 (special_summon)" or "trigger 0 subject". */
  where: string;
  field: string;
  value: string;
  /** The clause(s) the action was matched to (weak leaks only). */
  clause: string | null;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (s: string) => new RegExp(`(?<![\\w-])${escapeRegExp(s)}(?![\\w])`, 'i');
const number = (n: number) => new RegExp(`(?<![\\d,])${n}(?![\\d])`);

const MONSTER_KIND_TEXT: Record<string, RegExp | null> = {
  normal: /Normal Monster|non-Effect/i,
  // "Effect Monster" is often implied ("a monster with an effect", or just "monster"): not checked.
  effect: null,
  // "a monster from the Extra Deck" is tagged as the Extra Deck kinds.
  fusion: /\bFusion\b|Extra Deck/i,
  ritual: word('Ritual'),
  toon: word('Toon'),
  spirit: word('Spirit'),
  union: word('Union'),
  gemini: word('Gemini'),
  tuner: word('Tuner'),
  synchro: /\bSynchro\b|Extra Deck/i,
  xyz: /\bXyz\b|Extra Deck/i,
  flip: word('FLIP'),
  pendulum: word('Pendulum'),
  link: /\bLink\b|Extra Deck/i,
};

const SPELL_TRAP_TYPE_TEXT: Record<string, RegExp> = {
  normal: /Normal (Spell|Trap)/i,
  counter: /Counter Trap/i,
  field: /Field Spell/i,
  equip: word('Equip'),
  continuous: word('Continuous'),
  quick_play: /Quick-Play/i,
  ritual: word('Ritual'),
};

type Term = { field: string; value: string; re: RegExp };

/** The printed words each restriction of a target stands for. Card types and excluded names aren't checked. */
const leafTerms = (l: TargetLeaf): Term[] => {
  const out: Term[] = [];
  const list = (field: keyof TargetLeaf, values: readonly string[] | undefined, re: (v: string) => RegExp | null, all = Infinity) => {
    // Every value, or all but one: really "any" (which card types cover; those aren't checked).
    if ((values?.length ?? 0) >= all - 1) return;
    for (const v of values ?? []) {
      const r = re(v);
      if (r) out.push({ field, value: v, re: r });
    }
  };
  list('archetypes', l.archetypes, (v) => new RegExp(escapeRegExp(v), 'i'));
  list('exclude_archetypes', l.exclude_archetypes, (v) => new RegExp(escapeRegExp(v), 'i'));
  list('names', l.names, (v) => new RegExp(escapeRegExp(v), 'i'));
  list('attributes', l.attributes, word);
  list('exclude_attributes', l.exclude_attributes, word);
  list('races', l.races, word);
  list('exclude_races', l.exclude_races, word);
  const kinds = Object.keys(MONSTER_KIND_TEXT).length;
  list('monster_kinds', l.monster_kinds, (v) => MONSTER_KIND_TEXT[v] ?? null, kinds);
  list('exclude_monster_kinds', l.exclude_monster_kinds, (v) => MONSTER_KIND_TEXT[v] ?? null, kinds);
  list('spell_trap_types', l.spell_trap_types, (v) => SPELL_TRAP_TYPE_TEXT[v] ?? null, Object.keys(SPELL_TRAP_TYPE_TEXT).length);
  for (const k of ['level', 'rank', 'link_rating', 'atk', 'def'] as const) {
    const c = l[k];
    if (c) out.push({ field: k, value: `${c.op} ${c.value}`, re: number(c.value) });
  }
  return out;
};

export const targetTerms = (t: Target | null): Term[] => {
  if (!t) return [];
  const { any_of, ...leaf } = t;
  const seen = new Set<string>();
  return [...leafTerms(leaf), ...(any_of ?? []).flatMap(leafTerms)].filter((x) => {
    const key = `${x.field}|${x.value}`;
    return !seen.has(key) && Boolean(seen.add(key));
  });
};

// ---------------------------------------------------------------------------
// Which clause of an effect performs an action
// ---------------------------------------------------------------------------

const VERB_TEXT: Record<string, RegExp> = {
  special_summon: /(Special|Fusion|Synchro|Xyz|Link|Ritual|Pendulum) Summon/i,
  normal_summon: /Normal Summon/i,
  flip_summon: /Flip Summon/i,
  set: /\bSet\b/,
  tribute: /\bTribute/i,
  add_to_hand: /\badd\b|to (your|the|its owner's|their) hand/i,
  send_to_gy: /\bsend\b|\bGY\b|Graveyard/i,
  banish: /\bbanish/i,
  destroy: /\bdestroy/i,
  return_to_hand: /\bhand\b/i,
  return_to_deck: /\bDeck\b/i,
  discard: /\bdiscard/i,
  reveal: /\breveal/i,
  take_control: /\bcontrol\b/i,
  attach_material: /\battach|material/i,
  detach_material: /\bdetach/i,
  equip: /\bequip/i,
  place_on_field: /\bplace\b/i,
  change_stats: /\bATK\b|\bDEF\b|\bLevel|\bRank/i,
  change_position: /\bposition/i,
};

/** Clauses: sentences, cost/condition parts (";" and ":"), bullets, and ", then" / ", also" continuations. */
export const clauses = (snippet: string): string[] => {
  // Quoted names keep their punctuation ("T.G. Striker", "Number C39: Utopia Ray"): swapped for
  // private-use characters while splitting.
  const PUNCT = '.:;';
  const MASKS = '';
  const masked = snippet.replace(/"[^"\n]*"/g, (q) => q.replace(/[.:;]/g, (ch) => MASKS[PUNCT.indexOf(ch)]!));
  return masked
    .split(/\.(?=\s|$)|[;:●\n]|,\s*(?=then\b|also\b|and if you do\b)/i)
    .map((c) => c.replace(/[-]/g, (ch) => PUNCT[MASKS.indexOf(ch)]!).trim())
    .filter(Boolean);
};

/**
 * "Special Summon it", "that Dragon monster", "the first target", "shuffle all 3 into the Deck": the
 * restrictions were stated in an earlier clause.
 */
const REFERS_BACK =
  /\b(its?|them|their|that|those|these|both|each|the (first|second|third|other|targeted|selected|chosen|declared|Tributed|destroyed|above)|all (\d+|two|three|four|five)|all (of )?(the )?targets?)\b/i;

/**
 * The text an action's restrictions should come from: the clauses naming its verb, plus everything before a
 * clause that refers back to earlier ones. Null when no clause names the verb (can't tell).
 */
export const actionText = (snippet: string, verb: string): string | null => {
  const re = VERB_TEXT[verb];
  if (!re) return null;
  const parts = clauses(snippet);
  const picked = new Set<number>();
  parts.forEach((c, i) => {
    if (!re.test(c)) return;
    if (REFERS_BACK.test(c)) for (let j = 0; j <= i; j++) picked.add(j);
    else picked.add(i);
  });
  return picked.size
    ? [...picked]
        .sort((a, b) => a - b)
        .map((i) => parts[i])
        .join(' / ')
    : null;
};

// ---------------------------------------------------------------------------

/** Where a value missing from the effect is printed: elsewhere on the card, or nowhere. */
const outside = (re: RegExp, cardText: string): LeakKind => (re.test(cardText) ? 'other_effect' : 'unprinted');

const actionLeaks = (e: TagEffect, a: TagAction, i: number, cardText: string): Leak[] => {
  const where = `action ${i} (${a.verb})`;
  const base = { effectIndex: e.effect_index, textSource: e.text_source, where };
  const terms = targetTerms(a.target);
  if (!terms.length) return [];
  const text = actionText(e.snippet, a.verb);
  return terms.flatMap((t): Leak[] => {
    if (!t.re.test(e.snippet)) return [{ ...base, kind: outside(t.re, cardText), field: t.field, value: t.value, clause: null }];
    if (text !== null && !t.re.test(text)) return [{ ...base, kind: 'other_clause', field: t.field, value: t.value, clause: text }];
    return [];
  });
};

/**
 * Misplaced target restrictions in a card's tagged effects. `cardText` is all of the card's text (card and
 * Pendulum); snippets should be as printed (run repairSnippets first).
 */
export const findLeaks = (effects: readonly TagEffect[], cardText: string): Leak[] =>
  effects
    .map((e) => ({ ...e, snippet: effectText(e.snippet, cardText) }))
    .flatMap((e) => [
      ...e.actions.flatMap((a, i) => actionLeaks(e, a, i, cardText)),
      // Trigger conditions are only checked against the whole effect.
      ...e.triggers.flatMap((t, i) =>
        (['subject', 'cause_card'] as const).flatMap((k) =>
          targetTerms(t[k])
            .filter((term) => !term.re.test(e.snippet))
            .map((term): Leak => ({
              kind: outside(term.re, cardText),
              effectIndex: e.effect_index,
              textSource: e.text_source,
              where: `trigger ${i} ${k}`,
              field: term.field,
              value: term.value,
              clause: null,
            })),
        ),
      ),
    ]);

/** The text an effect's restrictions may come from: its snippet, plus the material line for "the above cards". */
export const effectText = (snippet: string, cardText: string): string => {
  const materials = materialLine(cardText);
  return materials && /\babove\b/i.test(snippet) ? `${materials}\n${snippet}` : snippet;
};

/**
 * Is any restriction of this alternative printed elsewhere on the card but not in the effect? (Leaked in
 * from another effect, like a GY effect's "Snake-Eye" in the card's Special Summon effect.)
 */
export const isLeakedAlternative = (alt: TargetLeaf, effect: string, cardText: string): boolean =>
  targetTerms(alt).some((t) => !t.re.test(effect) && t.re.test(cardText));

/** An Extra Deck monster's material line ('"Cyber Dragon" + "Cyber Dragon"'): its first line, with no full stop. */
export const materialLine = (cardText: string): string | null => {
  const [first, ...rest] = cardText.split('\n');
  return rest.length && first && !/[.:;]\s*$/.test(first) && /\+|\bTuner\b|\bmonsters?\b/i.test(first) ? first : null;
};
