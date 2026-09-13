import { describe, expect, it } from 'vitest';
import { SPELL_FRAME_TYPE_ID, TRAP_FRAME_TYPE_ID } from './cardFilterRule';
import {
  findMetaltronusMatches,
  getMetaltronusSharedProperties,
  isLegalMetaltronusMonster,
  isMetaltronusMatch,
  isTokenFrameName,
  isTokenMonsterName,
  type MetaltronusCard,
} from './metaltronus';

const card = (partial: Partial<MetaltronusCard> & Pick<MetaltronusCard, 'id' | 'name'>): MetaltronusCard => ({
  species_id: null,
  attribute_id: null,
  atk: null,
  frame_type_id: 1,
  ...partial,
});

describe('isTokenMonsterName', () => {
  it('detects printed Token names', () => {
    expect(isTokenMonsterName('Token')).toBe(true);
    expect(isTokenMonsterName('Sheep Token')).toBe(true);
    expect(isTokenMonsterName('Ojama Token')).toBe(true);
  });

  it('does not treat non-token names that mention Token as tokens', () => {
    expect(isTokenMonsterName('Token Collector')).toBe(false);
    expect(isTokenMonsterName('Dark Magician')).toBe(false);
  });
});

describe('isTokenFrameName', () => {
  it('matches Token frames case-insensitively', () => {
    expect(isTokenFrameName('Token')).toBe(true);
    expect(isTokenFrameName('token')).toBe(true);
    expect(isTokenFrameName('Effect')).toBe(false);
  });
});

describe('isLegalMetaltronusMonster', () => {
  it('excludes spells, traps, and token names', () => {
    expect(isLegalMetaltronusMonster({ name: 'Raigeki', frame_type_id: SPELL_FRAME_TYPE_ID })).toBe(false);
    expect(isLegalMetaltronusMonster({ name: 'Infinite Impermanence', frame_type_id: TRAP_FRAME_TYPE_ID })).toBe(false);
    expect(isLegalMetaltronusMonster({ name: 'Sheep Token', frame_type_id: 1 })).toBe(false);
  });

  it('excludes token frames when those ids are supplied', () => {
    expect(isLegalMetaltronusMonster({ name: 'Mystery Token Card', frame_type_id: 99 }, new Set([99]))).toBe(false);
  });

  it('keeps Main Deck and Extra Deck monsters', () => {
    expect(isLegalMetaltronusMonster({ name: 'Dark Magician', frame_type_id: 1 })).toBe(true);
    expect(isLegalMetaltronusMonster({ name: 'Accesscode Talker', frame_type_id: 2 })).toBe(true);
    expect(isLegalMetaltronusMonster({ name: 'Token Collector', frame_type_id: 1 })).toBe(true);
  });
});

describe('getMetaltronusSharedProperties / isMetaltronusMatch', () => {
  const darkMagician = card({
    id: 46986414,
    name: 'Dark Magician',
    species_id: 2,
    attribute_id: 2,
    atk: 2500,
  });

  const darkMagicianGirl = card({
    id: 38033121,
    name: 'Dark Magician Girl',
    species_id: 2,
    attribute_id: 2,
    atk: 2000,
  });

  const atkAndType = card({
    id: 1,
    name: 'Type ATK',
    species_id: 2,
    attribute_id: 1,
    atk: 2500,
  });

  const atkAndAttribute = card({
    id: 2,
    name: 'Attr ATK',
    species_id: 1,
    attribute_id: 2,
    atk: 2500,
  });

  const typeOnly = card({
    id: 3,
    name: 'Type Only',
    species_id: 2,
    attribute_id: 1,
    atk: 1000,
  });

  const blueEyes = card({
    id: 89631139,
    name: 'Blue-Eyes White Dragon',
    species_id: 1,
    attribute_id: 1,
    atk: 3000,
  });

  it('counts Type + Attribute as a legal pair', () => {
    expect(getMetaltronusSharedProperties(darkMagician, darkMagicianGirl).sort()).toEqual(['attribute', 'type']);
    expect(isMetaltronusMatch(darkMagician, darkMagicianGirl)).toBe(true);
  });

  it('counts Type + ATK and Attribute + ATK as legal pairs', () => {
    expect(getMetaltronusSharedProperties(darkMagician, atkAndType).sort()).toEqual(['atk', 'type']);
    expect(isMetaltronusMatch(darkMagician, atkAndType)).toBe(true);
    expect(getMetaltronusSharedProperties(darkMagician, atkAndAttribute).sort()).toEqual(['atk', 'attribute']);
    expect(isMetaltronusMatch(darkMagician, atkAndAttribute)).toBe(true);
  });

  it('rejects a single shared property or none', () => {
    expect(getMetaltronusSharedProperties(darkMagician, typeOnly)).toEqual(['type']);
    expect(isMetaltronusMatch(darkMagician, typeOnly)).toBe(false);
    expect(getMetaltronusSharedProperties(darkMagician, blueEyes)).toEqual([]);
    expect(isMetaltronusMatch(darkMagician, blueEyes)).toBe(false);
  });

  it('does not treat null ATK as a shared value', () => {
    const linkA = card({ id: 10, name: 'Link A', species_id: 1, attribute_id: 1, atk: null });
    const linkB = card({ id: 11, name: 'Link B', species_id: 1, attribute_id: 1, atk: null });
    expect(getMetaltronusSharedProperties(linkA, linkB)).toEqual(['type', 'attribute']);
    expect(isMetaltronusMatch(linkA, linkB)).toBe(true);
  });
});

describe('findMetaltronusMatches', () => {
  const target = card({
    id: 100,
    name: 'Start',
    species_id: 1,
    attribute_id: 1,
    atk: 1800,
  });

  const twoProps = card({
    id: 101,
    name: 'Two Props',
    species_id: 1,
    attribute_id: 1,
    atk: 1900,
  });

  const oneProp = card({
    id: 102,
    name: 'One Prop',
    species_id: 1,
    attribute_id: 2,
    atk: 2000,
  });

  const extraDeck = card({
    id: 103,
    name: 'Extra Deck',
    species_id: 1,
    attribute_id: 3,
    atk: 1800,
    frame_type_id: 2,
  });

  const token = card({
    id: 104,
    name: 'Sheep Token',
    species_id: 1,
    attribute_id: 1,
    atk: 1800,
  });

  const sameName = card({
    id: 105,
    name: 'Start',
    species_id: 1,
    attribute_id: 1,
    atk: 1800,
  });

  const pool = [target, twoProps, oneProp, extraDeck, token, sameName];

  it('returns only legal monsters sharing two or more properties', () => {
    const matches = findMetaltronusMatches(target, pool);
    expect(matches.map((c) => c.id).sort((a, b) => a - b)).toEqual([100, 101, 103, 105]);
    expect(matches.find((c) => c.id === 101)?.shared.sort()).toEqual(['attribute', 'type']);
    expect(matches.find((c) => c.id === 103)?.shared.sort()).toEqual(['atk', 'type']);
  });

  it('marks same-name copies for the face-down banish clause', () => {
    const matches = findMetaltronusMatches(target, pool);
    expect(matches.find((c) => c.id === 100)?.sameName).toBe(true);
    expect(matches.find((c) => c.id === 105)?.sameName).toBe(true);
    expect(matches.find((c) => c.id === 101)?.sameName).toBe(false);
  });
});
