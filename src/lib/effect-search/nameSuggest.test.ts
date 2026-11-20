import { describe, expect, it } from 'vitest';
import { applySuggestion, nameList, suggestNames } from './nameSuggest';

const list = nameList([
  'Original Sinful Spoils - Snake-Eye',
  'Snake-Eye Ash',
  'Snake-Eyes Poplar',
  'Mixousia the Confounder',
  'Toadally Awesome',
  'Monster Reborn',
  'Cards of Consonance',
]);

describe('suggestNames', () => {
  it('completes a name at the end of a request', () => {
    const input = 'cards that can be summoned by Original Sin';
    const s = suggestNames(list, input);
    expect(s.names).toEqual(['Original Sinful Spoils - Snake-Eye']);
    expect(applySuggestion(input, s.start, s.names[0]!)).toBe('cards that can be summoned by "Original Sinful Spoils - Snake-Eye" ');
  });

  it('prefers the longest run of words', () => {
    expect(suggestNames(list, 'summoned by snake-eye a').names).toEqual(['Snake-Eye Ash']);
    expect(suggestNames(list, 'summoned by snake-eye').names).toEqual(['Snake-Eye Ash', 'Snake-Eyes Poplar']);
  });

  it('falls back to a word inside the name', () => {
    expect(suggestNames(list, 'what can Confound').names).toEqual(['Mixousia the Confounder']);
  });

  it('ignores request words and finished names', () => {
    expect(suggestNames(list, 'cards that').names).toEqual([]);
    expect(suggestNames(list, 'level 4 monsters').names).toEqual([]);
    expect(suggestNames(list, 'summoned by "Toadally Awesome" ').names).toEqual([]);
    expect(suggestNames(list, 'summoned by Toadally Awesome').names).toEqual([]);
  });

  it('completes inside an open quote', () => {
    const input = 'special summon "toa';
    const s = suggestNames(list, input);
    expect(s.names).toEqual(['Toadally Awesome']);
    expect(applySuggestion(input, s.start, 'Toadally Awesome')).toBe('special summon "Toadally Awesome" ');
  });

  it('treats the whole input as the name in a name field', () => {
    expect(suggestNames(list, 'mixou', { whole: true }).names).toEqual(['Mixousia the Confounder']);
  });
});
