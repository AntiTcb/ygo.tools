import type { TagEffect } from './tagSchema';

const QUOTES = /["'“”‘’]/;

/**
 * The text with whitespace runs collapsed and quote characters dropped, plus where each kept
 * character came from, so a snippet that only differs in those can be found in the original.
 */
const loose = (text: string): { chars: string; at: number[] } => {
  let chars = '';
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (QUOTES.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (chars.endsWith(' ') || !chars) continue;
      chars += ' ';
    } else chars += ch;
    at.push(i);
  }
  return { chars, at };
};

/** Where the snippet is in the text: verbatim, else ignoring whitespace and quote differences. */
const locate = (text: string, snippet: string, from: number): { start: number; end: number } | null => {
  for (const f of [from, 0]) {
    const at = text.indexOf(snippet, f);
    if (at >= 0) return { start: at, end: at + snippet.length };
  }
  const t = loose(text);
  const s = loose(snippet).chars.trim();
  if (s.length < 12) return null;
  const at = t.chars.indexOf(s);
  if (at < 0) return null;
  let end = t.at[at + s.length - 1]! + 1;
  // Keep a closing quote the snippet dropped: 'Garma Sword Oath'. -> "Garma Sword Oath".
  if (text[end] === '"' && (text.slice(t.at[at]!, end).split('"').length - 1) % 2 === 1) end++;
  return { start: t.at[at]!, end };
};

/** Does an effect starting here begin a new sentence or bullet (not "or, if ..." mid-sentence)? */
const startsSentence = (text: string, at: number) => at === 0 || /[.:;)●\n]\s*$/.test(text.slice(Math.max(0, at - 3), at));

/** The hard once-per-turn line belongs to the whole card, not to one effect. */
const dropOncePerTurn = (s: string) => {
  for (let prev = ''; prev !== s;) {
    prev = s;
    s = s.replace(/\s*You can only (?:use|activate|Special Summon|apply)\b[^.]*\.$/, '').trim();
  }
  return s;
};

/**
 * Restores snippets the tagger didn't copy verbatim from the card text:
 * - cut short at a double quote (with structured outputs an unescaped `"` ends the string, leaving
 *   `Target 1 of your Xyz Monsters or `): extended from the text up to where the card's next effect
 *   starts, without the card's once-per-turn line;
 * - whitespace or quotes changed (newlines before ● collapsed, `"Name"` written as `'Name'`): replaced
 *   with the text as printed.
 * Snippets that can't be found in the text (paraphrased) are left alone.
 */
export const repairSnippets = <E extends Pick<TagEffect, 'snippet' | 'text_source' | 'effect_index'>>(
  effects: E[],
  texts: { card: string | null; pendulum: string | null },
): E[] => {
  const found = new Map<E, { start: number; end: number }>();
  for (const source of ['card', 'pendulum'] as const) {
    const text = texts[source];
    if (!text) continue;
    let from = 0;
    for (const e of effects.filter((x) => x.text_source === source).sort((a, b) => a.effect_index - b.effect_index)) {
      const hit = locate(text, e.snippet, from);
      if (!hit) continue;
      found.set(e, hit);
      from = hit.start + 1;
    }
  }
  return effects.map((e) => {
    const text = texts[e.text_source as 'card' | 'pendulum'];
    const hit = found.get(e);
    if (!text || !hit) return e;
    let snippet = text.slice(hit.start, hit.end).trim();
    if (text[hit.end] === '"') {
      const next = [...found.entries()]
        .filter(([other, h]) => other !== e && other.text_source === e.text_source && h.start > hit.start && startsSentence(text, h.start))
        .reduce((min, [, h]) => Math.min(min, h.start), text.length);
      const whole = text.slice(hit.start, next).trim();
      const trimmed = dropOncePerTurn(whole);
      // Keep the once-per-turn line when the snippet already reached into it ("You can only use this effect of ").
      snippet = trimmed.length >= snippet.length ? trimmed : whole;
    }
    return snippet !== e.snippet && snippet.length >= e.snippet.trim().length * 0.9 ? { ...e, snippet } : e;
  });
};
