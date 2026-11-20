import { isNamedCard, SELF, type QueryTarget } from './query';
import { targetSchema, type NumCmp, type Target } from './tagSchema';

/**
 * Edits to a query's card description (`target`, `cause_card`, `card_filter`) from the /search editor.
 * Targets never hold empty lists (the schema requires at least one value), and an empty target is null
 * ("any card").
 */

export const LIST_FIELDS = ['card_types', 'attributes', 'races', 'monster_kinds', 'spell_trap_types', 'archetypes'] as const;
export type ListField = (typeof LIST_FIELDS)[number];

export const NUM_FIELDS = ['level', 'rank', 'link_rating', 'atk', 'def'] as const;
export type NumField = (typeof NUM_FIELDS)[number];

/** Fields the editor shows only as removable chips (rare in parsed queries). */
export const OTHER_FIELDS = [
  'names',
  'exclude_names',
  'exclude_attributes',
  'exclude_races',
  'exclude_monster_kinds',
  'exclude_archetypes',
  'any_of',
] as const;
export type OtherField = (typeof OTHER_FIELDS)[number];

/** Drops empty lists and unset fields; null when nothing is left. */
export const cleanTarget = (t: Target | null): Target | null => {
  if (!t) return null;
  const out = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));
  return Object.keys(out).length ? (out as Target) : null;
};

const listOf = (t: Target | null, field: ListField): string[] => (t?.[field] as string[] | undefined) ?? [];

export const hasValue = (t: Target | null, field: ListField, value: string) => listOf(t, field).includes(value);

export const toggleValue = (t: Target | null, field: ListField, value: string): Target | null => {
  const list = listOf(t, field);
  return cleanTarget({ ...t, [field]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as Target);
};

export const addValue = (t: Target | null, field: ListField, value: string): Target | null => {
  const v = value.trim();
  return !v || hasValue(t, field, v) ? t : toggleValue(t, field, v);
};

export const setNum = (t: Target | null, field: NumField, cmp: NumCmp | null): Target | null =>
  cleanTarget({ ...t, [field]: cmp ?? undefined } as Target);

export const clearField = (t: Target | null, field: ListField | NumField | OtherField): Target | null =>
  cleanTarget({ ...t, [field]: undefined } as Target);

/** Monster-only conditions are shown unless the description is limited to Spells/Traps (and vice versa). */
export const showsMonsterFields = (t: Target | null) => !listOf(t, 'card_types').length || hasValue(t, 'card_types', 'monster');
export const showsSpellTrapFields = (t: Target | null) => hasValue(t, 'card_types', 'spell') || hasValue(t, 'card_types', 'trap');

/** True when `t` is a valid target (or null); edits from the UI are checked before they go into the URL. */
export const isValidTarget = (t: Target | null) => t === null || targetSchema.safeParse(t).success;

/** What a query card slot holds, as the /search editor shows it. */
export type PickedTarget = { kind: 'any' } | { kind: 'self' } | { kind: 'card'; card: string } | { kind: 'described'; target: Target };

/** Reads a query slot; `self` is the responds_to `subject_is_self` flag (does-mode uses the SELF card name). */
export const pickedFrom = (t: QueryTarget | null, self = false): PickedTarget => {
  if (self || (isNamedCard(t) && t.card === SELF)) return { kind: 'self' };
  if (!t) return { kind: 'any' };
  return isNamedCard(t) ? { kind: 'card', card: t.card } : { kind: 'described', target: t };
};

/** The slot value for a pick; 'self' maps to the SELF card name (callers using `subject_is_self` handle it first). */
export const pickedTarget = (p: PickedTarget): QueryTarget | null =>
  p.kind === 'any' ? null : p.kind === 'self' ? { card: SELF } : p.kind === 'card' ? { card: p.card } : cleanTarget(p.target);
