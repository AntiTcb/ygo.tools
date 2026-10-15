import type { TagEffect } from './tagSchema';

/**
 * Restores snippets cut short at a double quote. With structured outputs, an unescaped `"` inside
 * the snippet string ends it (`Target 1 of your Xyz Monsters or ` instead of the whole effect), so a
 * snippet that stops right before a quote in the card text is extended from the text itself: up to
 * where the card's next effect starts, minus a trailing "You can only use ... per turn." sentence.
 * Snippets that don't stop before a quote are left alone.
 */
export const repairSnippets = <E extends Pick<TagEffect, 'snippet' | 'text_source' | 'effect_index'>>(
  effects: E[],
  texts: { card: string | null; pendulum: string | null },
): E[] => {
  const starts = new Map<E, number>();
  for (const source of ['card', 'pendulum'] as const) {
    const text = texts[source];
    if (!text) continue;
    let from = 0;
    for (const e of effects.filter((x) => x.text_source === source).sort((a, b) => a.effect_index - b.effect_index)) {
      const at = text.indexOf(e.snippet, from);
      if (at < 0) continue;
      starts.set(e, at);
      from = at + 1;
    }
  }
  return effects.map((e) => {
    const text = texts[e.text_source as 'card' | 'pendulum'];
    const start = starts.get(e);
    if (!text || start === undefined || text[start + e.snippet.length] !== '"') return e;
    const next = [...starts.entries()]
      .filter(([other, at]) => other !== e && other.text_source === e.text_source && at > start)
      .reduce((min, [, at]) => Math.min(min, at), text.length);
    let snippet = text.slice(start, next).trim();
    // The hard once-per-turn line belongs to the whole card, not to this effect.
    for (let prev = ''; prev !== snippet;) {
      prev = snippet;
      snippet = snippet.replace(/\s*You can only (?:use|activate|Special Summon|apply)\b[^.]*\.$/, '').trim();
    }
    return snippet.length > e.snippet.trim().length ? { ...e, snippet } : e;
  });
};
