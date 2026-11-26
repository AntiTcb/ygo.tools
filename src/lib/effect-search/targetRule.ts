import type { Condition, RuleNode } from '../db/cardFilterRule';
import { MONSTER_KIND_IDS, RACE_IDS, SPELL_TRAP_TYPE_IDS, type NumCmp, type Target, type TargetLeaf } from './tagSchema';

/** `cardEnums.ATTRIBUTES` ids by printed name. */
const ATTRIBUTE_IDS = { LIGHT: 1, DARK: 2, WATER: 3, FIRE: 4, EARTH: 5, WIND: 6, DIVINE: 7 } as const;

const CARD_TYPE_IDS = { monster: 1, spell: 2, trap: 3 } as const;

const XYZ = MONSTER_KIND_IDS.xyz;

/** Exact-name → card id lookup; returns undefined when no English card has that name. */
export type NameResolver = (name: string) => number | undefined;

const cond = (condition: Condition): RuleNode => ({ kind: 'cond', condition });
const and = (children: RuleNode[]): RuleNode => (children.length === 1 ? children[0]! : { kind: 'group', logic: 'and', children });
const or = (children: RuleNode[]): RuleNode => (children.length === 1 ? children[0]! : { kind: 'group', logic: 'or', children });

/** Matches no card (no card has a negative id). */
const NOTHING = cond({ kind: 'num', field: 'id', op: 'lt', value: 0 });

const numCmp = (field: 'level' | 'link_rating' | 'atk' | 'def', c: NumCmp): RuleNode[] => {
  const parts = [cond({ kind: 'num', field, op: c.op, value: c.value })];
  // Printed "?" is stored as -1, which would otherwise satisfy "ATK 1500 or less".
  if ((field === 'atk' || field === 'def') && (c.op === 'lt' || c.op === 'lte' || c.op === 'neq')) {
    parts.push(cond({ kind: 'num', field, op: 'notQuestion' }));
  }
  return parts;
};

const leafToRule = (leaf: TargetLeaf, resolve: NameResolver, unresolved: Set<string>): RuleNode[] => {
  const parts: RuleNode[] = [];
  // Neuron stores Spells/Traps with level 0 and ATK/DEF 0, so stat constraints must imply a monster.
  // "non-WATER" / "non-Machine" also mean a monster (Spells/Traps have no Type and pseudo-Attributes).
  const hasStats = leaf.level || leaf.rank || leaf.link_rating || leaf.atk || leaf.def || leaf.exclude_attributes || leaf.exclude_races;
  if (hasStats && !leaf.card_types) parts.push(cond({ kind: 'cat', field: 'card_type', op: 'in', values: [CARD_TYPE_IDS.monster] }));
  if (leaf.card_types) parts.push(cond({ kind: 'cat', field: 'card_type', op: 'in', values: leaf.card_types.map((t) => CARD_TYPE_IDS[t]) }));
  if (leaf.attributes) parts.push(cond({ kind: 'cat', field: 'attribute_id', op: 'in', values: leaf.attributes.map((a) => ATTRIBUTE_IDS[a]) }));
  if (leaf.races) parts.push(cond({ kind: 'cat', field: 'species_id', op: 'in', values: leaf.races.map((r) => RACE_IDS[r]) }));
  if (leaf.exclude_attributes) {
    parts.push(cond({ kind: 'cat', field: 'attribute_id', op: 'notIn', values: leaf.exclude_attributes.map((a) => ATTRIBUTE_IDS[a]) }));
  }
  if (leaf.exclude_races) parts.push(cond({ kind: 'cat', field: 'species_id', op: 'notIn', values: leaf.exclude_races.map((r) => RACE_IDS[r]) }));
  if (leaf.monster_kinds) {
    parts.push(cond({ kind: 'cat', field: 'frame_subtype', op: 'in', values: leaf.monster_kinds.map((k) => MONSTER_KIND_IDS[k]) }));
  }
  if (leaf.exclude_monster_kinds) {
    parts.push(cond({ kind: 'cat', field: 'frame_subtype', op: 'notIn', values: leaf.exclude_monster_kinds.map((k) => MONSTER_KIND_IDS[k]) }));
  }
  if (leaf.spell_trap_types) {
    if (!leaf.card_types) parts.push(cond({ kind: 'cat', field: 'card_type', op: 'in', values: [CARD_TYPE_IDS.spell, CARD_TYPE_IDS.trap] }));
    parts.push(cond({ kind: 'cat', field: 'effect_id', op: 'in', values: leaf.spell_trap_types.map((t) => SPELL_TRAP_TYPE_IDS[t]) }));
  }
  // Neuron stores Rank in `level`, so Level/Rank conditions also pin whether the monster is an Xyz.
  if (leaf.level) parts.push(...numCmp('level', leaf.level), cond({ kind: 'cat', field: 'frame_subtype', op: 'notIn', values: [XYZ] }));
  if (leaf.rank) parts.push(...numCmp('level', leaf.rank), cond({ kind: 'cat', field: 'frame_subtype', op: 'in', values: [XYZ] }));
  if (leaf.link_rating) parts.push(...numCmp('link_rating', leaf.link_rating));
  if (leaf.atk) parts.push(...numCmp('atk', leaf.atk));
  if (leaf.def) parts.push(...numCmp('def', leaf.def));
  if (leaf.archetypes) parts.push(cond({ kind: 'archetype', op: 'in', values: leaf.archetypes }));
  if (leaf.exclude_archetypes) parts.push(cond({ kind: 'archetype', op: 'notIn', values: leaf.exclude_archetypes }));

  const ids = (names: string[]) =>
    names.flatMap((n) => {
      const id = resolve(n);
      if (id === undefined) unresolved.add(n);
      return id === undefined ? [] : [id];
    });
  if (leaf.names) {
    const found = ids(leaf.names);
    parts.push(found.length ? or(found.map((id) => cond({ kind: 'num', field: 'id', op: 'eq', value: id }))) : NOTHING);
  }
  if (leaf.exclude_names) {
    for (const id of ids(leaf.exclude_names)) parts.push(cond({ kind: 'num', field: 'id', op: 'neq', value: id }));
  }
  return parts;
};

/**
 * Converts a tagger target into a `RuleNode`. The result may contain the virtual `card_type` /
 * `frame_subtype` fields, so run it through `resolveVirtualRuleTree` before `evalRuleNode`.
 * Names that don't resolve are reported (and match nothing) rather than silently dropped.
 */
export const targetToRule = (target: Target, resolve: NameResolver): { rule: RuleNode; unresolvedNames: string[] } => {
  const unresolved = new Set<string>();
  const parts = leafToRule(target, resolve, unresolved);
  if (target.any_of) parts.push(or(target.any_of.map((leaf) => and(leafToRule(leaf, resolve, unresolved)))));
  return { rule: parts.length ? and(parts) : { kind: 'group', logic: 'and', children: [] }, unresolvedNames: [...unresolved] };
};

const cmpText = (c: NumCmp): string =>
  ({
    eq: `${c.value}`,
    neq: `not ${c.value}`,
    lt: `below ${c.value}`,
    lte: `${c.value} or lower`,
    gt: `above ${c.value}`,
    gte: `${c.value} or higher`,
  })[c.op];

const leafText = (leaf: TargetLeaf): string => {
  const words: string[] = [];
  if (leaf.level) words.push(`Level ${cmpText(leaf.level)}`);
  if (leaf.rank) words.push(`Rank ${cmpText(leaf.rank)}`);
  if (leaf.link_rating) words.push(`Link ${cmpText(leaf.link_rating)}`);
  if (leaf.exclude_attributes) words.push(leaf.exclude_attributes.map((a) => `non-${a}`).join(' '));
  if (leaf.attributes) words.push(leaf.attributes.join('/'));
  if (leaf.archetypes) words.push(leaf.archetypes.map((a) => `"${a}"`).join('/'));
  if (leaf.exclude_races) words.push(leaf.exclude_races.map((r) => `non-${r}`).join(' '));
  if (leaf.races) words.push(leaf.races.join('/'));
  if (leaf.exclude_monster_kinds) words.push(leaf.exclude_monster_kinds.map((k) => `non-${k}`).join(' '));
  if (leaf.monster_kinds) words.push(leaf.monster_kinds.join('/'));
  if (leaf.spell_trap_types) words.push(leaf.spell_trap_types.join('/'));
  words.push(leaf.card_types?.join('/') ?? (leaf.spell_trap_types ? 'spell/trap' : 'card'));
  if (leaf.names) words.unshift(leaf.names.map((n) => `"${n}"`).join(' or '));
  if (leaf.atk) words.push(`with ATK ${cmpText(leaf.atk)}`);
  if (leaf.def) words.push(`with DEF ${cmpText(leaf.def)}`);
  if (leaf.exclude_archetypes) words.push(`(not ${leaf.exclude_archetypes.map((a) => `"${a}"`).join('/')})`);
  if (leaf.exclude_names) words.push(`(except ${leaf.exclude_names.map((n) => `"${n}"`).join(', ')})`);
  return words.join(' ');
};

/** Short English rendering of a target, for the admin inspector and "why it matched". */
export const describeTarget = (target: Target | null): string => {
  if (!target) return 'any card';
  const { any_of, ...leaf } = target;
  const base = Object.keys(leaf).length ? leafText(leaf) : '';
  if (!any_of) return base || 'any card';
  const alts = any_of.map(leafText).join(' or ');
  return base ? `${base}, and (${alts})` : alts;
};
