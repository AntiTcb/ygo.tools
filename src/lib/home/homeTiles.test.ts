import { describe, expect, it } from 'vitest';
import { GIZMEK_UKA_CARD_ID, HOME_HELPER_TILES, HOME_TOOL_TILES, METALTRONUS_CARD_ID, SMALL_WORLD_CARD_ID, sortTilesByTitle } from './homeTiles';

describe('sortTilesByTitle', () => {
  it('sorts titles alphabetically without mutating the input', () => {
    const input = [{ title: 'Small World Helper' }, { title: 'Card Database' }, { title: 'Metaltronus Helper' }];
    expect(sortTilesByTitle(input).map((t) => t.title)).toEqual(['Card Database', 'Metaltronus Helper', 'Small World Helper']);
    expect(input.map((t) => t.title)).toEqual(['Small World Helper', 'Card Database', 'Metaltronus Helper']);
  });
});

describe('HOME_TOOL_TILES / HOME_HELPER_TILES', () => {
  it('keeps tool tiles in alphabetical title order', () => {
    expect(HOME_TOOL_TILES.map((t) => t.title)).toEqual(['Card Database', 'Damage Calculation Calculator']);
  });

  it('keeps helper tiles in alphabetical title order with card art ids', () => {
    expect(HOME_HELPER_TILES.map((t) => t.title)).toEqual(['Gizmek Uka Helper', 'Metaltronus Helper', 'Small World Helper']);
    expect(HOME_HELPER_TILES.map((t) => t.cardId)).toEqual([GIZMEK_UKA_CARD_ID, METALTRONUS_CARD_ID, SMALL_WORLD_CARD_ID]);
  });
});
