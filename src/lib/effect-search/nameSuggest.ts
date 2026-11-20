/**
 * Card-name completion for the /search box: finds the card name the user is in the middle of typing at the
 * end of a free-text request ("cards summoned by Original Sin" -> "Original Sinful Spoils - Snake-Eye").
 */

export type NameSuggestions = {
  /** Where the typed part of the name starts: replace `input.slice(start)` with the chosen name. */
  start: number;
  names: string[];
};

/** Words that start requests rather than card names ("cards that...", "level 4 monsters"). */
const STOP_WORDS = new Set(
  'a an and any are as at be by can card cards do does effect effects for from in is it its level link of on or rank that the their them they this to what when which who with whose monster monsters spell spells trap traps summon summons summoned special'.split(
    ' ',
  ),
);

const MAX_WORDS = 7;

/** Lower-cased names, for matching without re-lowering per request. */
export type NameList = { names: readonly string[]; lower: readonly string[] };

export const nameList = (names: Iterable<string>): NameList => {
  const sorted = [...new Set(names)].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return { names: sorted, lower: sorted.map((n) => n.toLowerCase()) };
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const prefixMatches = (list: NameList, frag: string, limit: number) => {
  const out: string[] = [];
  for (let i = 0; i < list.lower.length && out.length < limit; i++) if (list.lower[i]!.startsWith(frag)) out.push(list.names[i]!);
  return out;
};

const wordMatches = (list: NameList, frag: string, limit: number) => {
  const re = new RegExp(`(?:^|[\\s"(-])${escapeRegExp(frag)}`);
  const out: string[] = [];
  for (let i = 0; i < list.lower.length && out.length < limit; i++) if (re.test(list.lower[i]!)) out.push(list.names[i]!);
  return out;
};

/**
 * Names completing the end of `input`. With `whole`, the whole input is the name being typed (a card-name
 * field); otherwise the name is found among the last few words, or after an unclosed quote.
 */
export const suggestNames = (list: NameList, input: string, opts: { whole?: boolean; limit?: number } = {}): NameSuggestions => {
  const limit = opts.limit ?? 8;
  const none: NameSuggestions = { start: input.length, names: [] };

  /** Suggestions for the text from `start`; `none` when that text is already a whole name (nothing to complete). */
  const tryFragment = (start: number, minLength: number, words: boolean): NameSuggestions | null => {
    const frag = input.slice(start).replace(/^"/, '').trimStart().toLowerCase();
    if (frag.trim().length < minLength) return null;
    const names = words ? wordMatches(list, frag, limit) : prefixMatches(list, frag, limit);
    if (names.length === 1 && names[0]!.toLowerCase() === frag.trim()) return none;
    return names.length ? { start, names } : null;
  };

  if (opts.whole) {
    const start = input.length - input.trimStart().length;
    return tryFragment(start, 2, false) ?? tryFragment(start, 3, true) ?? none;
  }

  // Inside an unclosed quote, everything after it is the name.
  const quotes = [...input.matchAll(/"/g)];
  if (quotes.length % 2 === 1) {
    const start = quotes.at(-1)!.index;
    return tryFragment(start, 1, false) ?? tryFragment(start, 3, true) ?? none;
  }
  // A finished quoted name ("Snake-Eye Ash" ) needs no completion.
  if (/"\s*$/.test(input)) return none;

  const words = [...input.matchAll(/\S+/g)].slice(-MAX_WORDS);
  // Longest run of trailing words first, so "Original Sinful" beats "Sinful". A run can't start inside a
  // finished quote or on a word that usually starts a request instead of a name.
  const starts = words
    .filter((w) => !STOP_WORDS.has(w[0].toLowerCase()) && !w[0].endsWith('"') && !input.slice(w.index).slice(1).includes('"'))
    .map((w) => w.index);
  for (const start of starts) {
    const hit = tryFragment(start, 3, false);
    if (hit) return hit;
  }
  for (const start of starts) {
    const hit = tryFragment(start, 4, true);
    if (hit) return hit;
  }
  return none;
};

/** The input with the typed part of the name replaced by the chosen name, quoted. */
export const applySuggestion = (input: string, start: number, name: string): string => `${input.slice(0, start).trimEnd()} "${name}" `.trimStart();
