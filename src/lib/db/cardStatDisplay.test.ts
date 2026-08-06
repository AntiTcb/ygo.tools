import { describe, expect, it } from 'vitest';
import { buildCardStatLine, formatAtkDef, formatLevelRankLink, formatPendScale } from './cardStatDisplay';

describe('formatAtkDef', () => {
  it('formats null/undefined as em dash', () => {
    expect(formatAtkDef(null)).toBe('—');
    expect(formatAtkDef(undefined)).toBe('—');
  });

  it('formats question-mark ATK/DEF as ?', () => {
    expect(formatAtkDef(-1)).toBe('?');
  });

  it('formats numeric values as strings', () => {
    expect(formatAtkDef(2500)).toBe('2500');
    expect(formatAtkDef(0)).toBe('0');
  });
});

describe('formatLevelRankLink', () => {
  it('prefers link rating when present', () => {
    expect(formatLevelRankLink({ level: 4, link_rating: 2 })).toBe('LINK-2');
  });

  it('uses Rank for xyz frames', () => {
    expect(formatLevelRankLink({ level: 4, link_rating: null, frameName: 'XYZ' })).toBe('Rank 4');
  });

  it('uses Level for non-xyz frames', () => {
    expect(formatLevelRankLink({ level: 7, link_rating: null, frameName: 'Effect' })).toBe('Level 7');
  });

  it('returns null when level and link are absent', () => {
    expect(formatLevelRankLink({ level: null, link_rating: null })).toBeNull();
  });
});

describe('formatPendScale', () => {
  it('returns null when both scales are missing', () => {
    expect(formatPendScale(null, null)).toBeNull();
  });

  it('formats partial and full scales', () => {
    expect(formatPendScale(3, null)).toBe('Scale 3/—');
    expect(formatPendScale(null, 8)).toBe('Scale —/8');
    expect(formatPendScale(1, 9)).toBe('Scale 1/9');
  });
});

describe('buildCardStatLine', () => {
  it('assembles attribute, type, level, scale, and ATK/DEF lines', () => {
    const speciesById = new Map([[1, 'Dragon']]);
    const frameById = new Map([[5, 'Effect']]);
    const line = buildCardStatLine(
      {
        atk: 3000,
        def: 2500,
        level: 8,
        link_rating: null,
        attribute_id: 2,
        species_id: 1,
        frame_type_id: 5,
        pend_scale_l: 1,
        pend_scale_r: 9,
      },
      { speciesById, frameById },
    );
    expect(line.attribute).toBe('DARK');
    expect(line.typeLine).toBe('Dragon · Effect');
    expect(line.levelLine).toBe('Level 8');
    expect(line.scaleLine).toBe('Scale 1/9');
    expect(line.atkDef).toBe('3000 / 2500');
  });

  it('handles sparse cards without lookups', () => {
    const line = buildCardStatLine(
      {
        atk: -1,
        def: null,
        level: null,
        link_rating: 3,
        attribute_id: null,
        species_id: null,
        frame_type_id: null,
        pend_scale_l: null,
        pend_scale_r: null,
      },
      { speciesById: new Map(), frameById: new Map() },
    );
    expect(line.attribute).toBeNull();
    expect(line.typeLine).toBeNull();
    expect(line.levelLine).toBe('LINK-3');
    expect(line.scaleLine).toBeNull();
    expect(line.atkDef).toBe('? / —');
  });
});
