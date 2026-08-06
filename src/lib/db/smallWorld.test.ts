import { describe, expect, it } from 'vitest';
import {
  findExactBridges,
  findExactTargets,
  getSharedProperties,
  isExactOneBridge,
  isMonsterCard,
  valuesEqualForSmallWorld,
  type SmallWorldCard,
} from './smallWorld';

const card = (partial: Partial<SmallWorldCard> & Pick<SmallWorldCard, 'id' | 'name'>): SmallWorldCard => ({
  species_id: null,
  attribute_id: null,
  level: null,
  atk: null,
  def: null,
  frame_type_id: 1,
  ...partial,
});

describe('valuesEqualForSmallWorld', () => {
  it('returns false when either side is null', () => {
    expect(valuesEqualForSmallWorld(null, null)).toBe(false);
    expect(valuesEqualForSmallWorld(4, null)).toBe(false);
    expect(valuesEqualForSmallWorld(null, 4)).toBe(false);
  });

  it('returns true only for equal numbers (including ? ATK -1)', () => {
    expect(valuesEqualForSmallWorld(2500, 2500)).toBe(true);
    expect(valuesEqualForSmallWorld(-1, -1)).toBe(true);
    expect(valuesEqualForSmallWorld(2500, 3000)).toBe(false);
  });
});

describe('isMonsterCard', () => {
  it('excludes spell and trap frames', () => {
    expect(isMonsterCard({ frame_type_id: 13 })).toBe(false);
    expect(isMonsterCard({ frame_type_id: 14 })).toBe(false);
  });

  it('includes monster frames', () => {
    expect(isMonsterCard({ frame_type_id: 1 })).toBe(true);
    expect(isMonsterCard({ frame_type_id: 5 })).toBe(true);
  });
});

describe('getSharedProperties / isExactOneBridge', () => {
  const darkMagician = card({
    id: 46986414,
    name: 'Dark Magician',
    species_id: 2, // Spellcaster
    attribute_id: 2, // DARK
    level: 7,
    atk: 2500,
    def: 2100,
  });

  const blueEyes = card({
    id: 89631139,
    name: 'Blue-Eyes White Dragon',
    species_id: 1, // Dragon
    attribute_id: 1, // LIGHT
    level: 8,
    atk: 3000,
    def: 2500,
  });

  const darkMagicianGirl = card({
    id: 38033121,
    name: 'Dark Magician Girl',
    species_id: 2,
    attribute_id: 2,
    level: 6,
    atk: 2000,
    def: 1700,
  });

  const atkBridge = card({
    id: 1,
    name: 'ATK Bridge',
    species_id: 99,
    attribute_id: 3,
    level: 4,
    atk: 2500,
    def: 1000,
  });

  it('counts each matching property once', () => {
    expect(getSharedProperties(darkMagician, darkMagicianGirl).sort()).toEqual(['attribute', 'type']);
    expect(isExactOneBridge(darkMagician, darkMagicianGirl)).toBe(false);
  });

  it('detects exactly-one ATK bridge', () => {
    expect(getSharedProperties(darkMagician, atkBridge)).toEqual(['atk']);
    expect(isExactOneBridge(darkMagician, atkBridge)).toBe(true);
  });

  it('returns empty when nothing matches (including null Level/DEF on Links)', () => {
    const linkA = card({ id: 10, name: 'Link A', species_id: 1, attribute_id: 1, level: null, atk: 1000, def: null });
    const linkB = card({ id: 11, name: 'Link B', species_id: 2, attribute_id: 2, level: null, atk: 2000, def: null });
    expect(getSharedProperties(linkA, linkB)).toEqual([]);
    expect(isExactOneBridge(linkA, linkB)).toBe(false);
  });

  it('allows Link bridges on a single shared Attribute', () => {
    const link = card({ id: 12, name: 'Link', species_id: 1, attribute_id: 2, level: null, atk: 1500, def: null });
    expect(getSharedProperties(darkMagician, link)).toEqual(['attribute']);
    expect(isExactOneBridge(darkMagician, link)).toBe(true);
  });

  it('does not bridge unrelated monsters', () => {
    expect(getSharedProperties(darkMagician, blueEyes)).toEqual([]);
    expect(isExactOneBridge(darkMagician, blueEyes)).toBe(false);
  });
});

describe('findExactBridges / findExactTargets', () => {
  const start = card({
    id: 100,
    name: 'Start',
    species_id: 1,
    attribute_id: 1,
    level: 4,
    atk: 1800,
    def: 1000,
  });

  const typeOnly = card({
    id: 101,
    name: 'Type Only',
    species_id: 1,
    attribute_id: 2,
    level: 5,
    atk: 1900,
    def: 1100,
  });

  const twoProps = card({
    id: 102,
    name: 'Two Props',
    species_id: 1,
    attribute_id: 1,
    level: 5,
    atk: 1900,
    def: 1100,
  });

  const fromBridge = card({
    id: 103,
    name: 'From Bridge',
    species_id: 3,
    attribute_id: 2,
    level: 6,
    atk: 2000,
    def: 1200,
  });

  const pool = [start, typeOnly, twoProps, fromBridge];

  it('finds only exact one-property bridges', () => {
    expect(findExactBridges(start, pool).map((c) => c.id)).toEqual([101]);
  });

  it('finds targets from the bridge and excludes start/bridge ids', () => {
    const targets = findExactTargets(typeOnly, pool, { excludeIds: [start.id] });
    expect(targets.map((t) => t.id)).toEqual([103]);
    expect(targets[0]?.shared).toEqual(['attribute']);
  });
});
