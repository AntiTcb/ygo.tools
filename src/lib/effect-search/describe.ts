import { describeTarget } from './targetRule';
import type { TagAction, TagTrigger } from './tagSchema';

const PLAYER_VERBS: ReadonlySet<string> = new Set(['draw', 'inflict_damage', 'gain_lp', 'lose_lp']);

const sideWord = { you: 'your', opponent: "opponent's", either: 'either player’s' } as const;

const zones = (zs: string[], side: TagAction['from_side']) => (zs.length ? `${side ? `${sideWord[side]} ` : ''}${zs.join('/')}` : '');

/** "COST: special_summon 1 × "Frog" card from your deck" */
export const describeAction = (a: TagAction): string => {
  const parts: string[] = [];
  if (a.is_cost) parts.push('COST:');
  parts.push(a.verb);
  // These affect a player, not a card: "inflict_damage 800 → opponent", "draw 2 → you".
  if (PLAYER_VERBS.has(a.verb)) {
    const amount = a.stat_amount ?? a.quantity;
    if (amount !== null) parts.push(String(amount));
    if (a.stat_amount_note) parts.push(`(${a.stat_amount_note})`);
    if (a.to_side) parts.push(`→ ${a.to_side === 'either' ? 'both players' : a.to_side}`);
    return parts.join(' ');
  }
  if (a.is_self) parts.push('this card');
  else {
    if (a.quantity) parts.push(`${a.quantity} ×`);
    if (a.name_refs.length) parts.push(a.name_refs.map((n) => `"${n}"`).join(' or '));
    if (a.target || !a.name_refs.length) parts.push(describeTarget(a.target));
  }
  const from = zones(a.from_zones, a.from_side);
  if (from) parts.push(`from ${from}`);
  const to = zones(a.to_zones, a.to_side) || (a.to_side ? `${sideWord[a.to_side]} side` : '');
  if (to) parts.push(`to ${to}`);
  if (a.stat) {
    parts.push(
      `[${a.stat} ${a.stat_mode}${a.stat_amount !== null ? ` ${a.stat_amount}` : ''}${a.stat_amount_note ? ` (${a.stat_amount_note})` : ''}]`,
    );
  }
  if (a.contextual) parts.push(`(depends: ${a.context_note ?? 'game state'})`);
  return parts.join(' ');
};

/** "send_to_gy: this card, as a cost for a WATER monster's effect" */
export const describeTrigger = (t: TagTrigger): string => {
  const parts = [`${t.event}:`, t.subject_is_self ? 'this card' : describeTarget(t.subject)];
  if (t.subject_side) parts.push(`(${sideWord[t.subject_side]})`);
  if (t.from_zones.length) parts.push(`from ${t.from_zones.join('/')}`);
  if (t.cause) {
    const by = t.cause_card ? ` of ${t.cause_side ? `${sideWord[t.cause_side]} ` : ''}${describeTarget(t.cause_card)}` : '';
    parts.push(`by ${t.cause}${by}`);
  }
  return parts.join(' ');
};
