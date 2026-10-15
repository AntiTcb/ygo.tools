import type { TagAction, TagTrigger, Target, TargetLeaf } from './tagSchema';

/**
 * Plain-English renderings of stored actions and triggers for /search ("why it matched"), written
 * close to card text: "Special Summons 1 Aqua monster from your GY". The admin inspector keeps the
 * compact debug form in describe.ts.
 */

type Side = TagAction['from_side'];

const KIND_WORDS: Record<string, string> = {
  normal: 'Normal',
  effect: 'Effect',
  fusion: 'Fusion',
  ritual: 'Ritual',
  toon: 'Toon',
  spirit: 'Spirit',
  union: 'Union',
  gemini: 'Gemini',
  tuner: 'Tuner',
  synchro: 'Synchro',
  xyz: 'Xyz',
  flip: 'Flip',
  pendulum: 'Pendulum',
  link: 'Link',
};

const SPELL_TRAP_WORDS: Record<string, string> = {
  normal: 'Normal',
  counter: 'Counter',
  field: 'Field',
  equip: 'Equip',
  continuous: 'Continuous',
  quick_play: 'Quick-Play',
  ritual: 'Ritual',
};

const ZONE_WORDS: Record<string, string> = {
  deck: 'Deck',
  extra_deck: 'Extra Deck',
  hand: 'hand',
  field: 'field',
  monster_zone: 'Monster Zone',
  spell_trap_zone: 'Spell & Trap Zone',
  pendulum_zone: 'Pendulum Zone',
  field_zone: 'Field Zone',
  gy: 'GY',
  banished: 'banishment',
  xyz_material: 'Xyz Materials',
};

const humanWord = (term: string) => term.replaceAll('_', ' ');

const list = (items: string[], joiner = 'or'): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`;

const cmp = (c: { op: string; value: number }): string =>
  ({
    eq: `${c.value}`,
    neq: `other than ${c.value}`,
    lt: `below ${c.value}`,
    lte: `${c.value} or lower`,
    gt: `above ${c.value}`,
    gte: `${c.value} or higher`,
  })[c.op] ?? `${c.value}`;

const quote = (names: readonly string[]) => list(names.map((n) => `"${n}"`));

/** Past this many excluded kinds, the list says more about tagging noise than about the card. */
const MAX_EXCLUDED_KINDS = 3;

type LeafParts = { adjectives: string[]; noun: string | null; tail: string[]; except: string[] };

/** The pieces of "Level 4 or lower WATER monster with 1600 or lower ATK, except ...". */
const leafParts = (leaf: TargetLeaf): LeafParts => {
  const adjectives: string[] = [];
  const archetypes = leaf.archetypes ?? [];
  if (leaf.names) adjectives.push(quote(leaf.names.filter((n) => !archetypes.includes(n))));
  if (leaf.level) adjectives.push(`Level ${cmp(leaf.level)}`);
  if (leaf.rank) adjectives.push(`Rank ${cmp(leaf.rank)}`);
  if (leaf.link_rating) adjectives.push(`Link-${cmp(leaf.link_rating)}`);
  if (leaf.exclude_monster_kinds && leaf.exclude_monster_kinds.length <= MAX_EXCLUDED_KINDS) {
    adjectives.push(leaf.exclude_monster_kinds.map((k) => `non-${KIND_WORDS[k] ?? k}`).join(' '));
  }
  if (leaf.attributes) adjectives.push(leaf.attributes.join('/'));
  if (archetypes.length) adjectives.push(archetypes.map((a) => `"${a}"`).join('/'));
  if (leaf.races) adjectives.push(leaf.races.join('/'));
  if (leaf.monster_kinds) adjectives.push(leaf.monster_kinds.map((k) => KIND_WORDS[k] ?? k).join('/'));

  const types = leaf.card_types ?? [];
  // Monster-only properties imply a monster even when the tag left card_types out.
  const monsterish = Boolean(
    leaf.attributes || leaf.races || leaf.monster_kinds || leaf.level || leaf.rank || leaf.link_rating || leaf.atk || leaf.def,
  );
  let noun: string | null = null;
  if (leaf.spell_trap_types) {
    const st = types.filter((t) => t !== 'monster');
    noun = `${leaf.spell_trap_types.map((t) => SPELL_TRAP_WORDS[t] ?? t).join('/')} ${st.length === 1 ? (st[0] === 'spell' ? 'Spell' : 'Trap') : 'Spell/Trap'}`;
  } else if (types.length === 1) noun = types[0] === 'monster' ? 'monster' : types[0] === 'spell' ? 'Spell' : 'Trap';
  else if (types.length === 2 && !types.includes('monster')) noun = 'Spell/Trap';
  else if (!types.length && monsterish) noun = 'monster';

  const tail: string[] = [];
  if (leaf.atk) tail.push(`${cmp(leaf.atk)} ATK`);
  if (leaf.def) tail.push(`${cmp(leaf.def)} DEF`);
  const except: string[] = [];
  if (leaf.exclude_archetypes) except.push(`${leaf.exclude_archetypes.map((a) => `"${a}"`).join('/')} cards`);
  if (leaf.exclude_names) except.push(quote(leaf.exclude_names));
  return { adjectives: adjectives.filter(Boolean), noun, tail, except };
};

const withTail = (text: string, tail: string[]) => (tail.length ? `${text} with ${tail.join(' and ')}` : text);

/**
 * A target as a noun phrase, and its exceptions separately so callers can put them after the zones:
 * "1 WATER monster from your hand or GY, except "Icejade Aegirine"".
 */
const targetPhrase = (target: Target | null, plural: boolean): { text: string; except: string } => {
  const nounOf = (noun: string | null) => {
    const n = noun ?? 'card';
    return plural ? `${n}s` : n;
  };
  if (!target) return { text: nounOf(null), except: '' };
  const { any_of, ...leaf } = target;
  const base = leafParts(leaf);
  const except = [...base.except];
  let qualifier = '';
  if (any_of?.length) {
    const baseWords = new Set([...base.adjectives, base.noun ?? '', ...base.tail]);
    const alts = any_of.map(leafParts);
    // An alternative the base already satisfies makes the whole any_of a no-op.
    const redundant = alts.some((a) => [...a.adjectives, ...a.tail].every((w) => baseWords.has(w)) && (!a.noun || a.noun === base.noun));
    if (!redundant) {
      const altTexts = [
        ...new Set(
          alts.map((a) => {
            const words = [...a.adjectives];
            if (a.noun && a.noun !== base.noun) words.push(a.noun);
            return withTail(words.join(' ') || a.noun || 'card', a.tail);
          }),
        ),
      ];
      // Alternatives that are only adjectives read naturally in front of the noun: "WATER/Machine monster".
      const simple = alts.every((a) => !a.tail.length && !a.except.length && (!a.noun || a.noun === base.noun) && a.adjectives.length === 1);
      if (simple) base.adjectives.push(altTexts.join(' or '));
      else qualifier = ` (${list(altTexts)})`;
      for (const a of alts) except.push(...a.except);
    }
  }
  const text = withTail([...base.adjectives, nounOf(base.noun)].join(' '), base.tail) + qualifier;
  return { text, except: [...new Set(except)].join(', ') };
};

export const humanTarget = (target: Target | null, plural = false): string => {
  const { text, except } = targetPhrase(target, plural);
  return except ? `${text}, except ${except}` : text;
};

// "Xyz" is said "ex", so it takes "an".
const article = (text: string) => (/^([aeiou]|xyz)/i.test(text) && !/^(one|uni)/i.test(text) ? `an ${text}` : `a ${text}`);

/** "a WATER monster", "this card", '"Dark Magician"'. */
const subjectText = (target: Target | null): string => {
  const text = humanTarget(target);
  return text.startsWith('"') ? text : article(text);
};

const sidePossessive = (side: Side): string =>
  side === 'you' ? 'your' : side === 'opponent' ? "your opponent's" : side === 'either' ? "either player's" : 'the';

/** "your hand or GY", "the Deck". */
const zonesText = (zones: readonly string[], side: Side): string =>
  zones.length ? `${sidePossessive(side)} ${list(zones.map((z) => ZONE_WORDS[z] ?? humanWord(z)))}` : '';

/** Card-affecting action verbs: the phrase, and the destination it already implies. */
const ACTION_PHRASES: Record<string, { verb: string; implies?: string; suffix?: string }> = {
  special_summon: { verb: 'Special Summons' },
  normal_summon: { verb: 'Normal Summons' },
  flip_summon: { verb: 'Flip Summons' },
  set: { verb: 'Sets' },
  tribute: { verb: 'Tributes' },
  add_to_hand: { verb: 'adds', implies: 'hand', suffix: 'to the hand' },
  send_to_gy: { verb: 'sends', implies: 'gy', suffix: 'to the GY' },
  banish: { verb: 'banishes' },
  destroy: { verb: 'destroys' },
  return_to_hand: { verb: 'returns', implies: 'hand', suffix: 'to the hand' },
  return_to_deck: { verb: 'returns', implies: 'deck', suffix: 'to the Deck' },
  discard: { verb: 'discards' },
  reveal: { verb: 'reveals' },
  negate_activation: { verb: 'negates the activation of' },
  negate_effect: { verb: 'negates the effects of' },
  negate_summon: { verb: 'negates the Summon of' },
  take_control: { verb: 'takes control of' },
  attach_material: { verb: 'attaches', implies: 'xyz_material', suffix: 'as Xyz Material' },
  detach_material: { verb: 'detaches' },
  equip: { verb: 'equips' },
  place_on_field: { verb: 'places', implies: 'field', suffix: 'on the field' },
  change_position: { verb: 'changes the battle position of' },
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STAT_WORDS = { atk: 'ATK', def: 'DEF', level: 'Level', rank: 'Rank' } as const;

const amountText = (a: TagAction) =>
  [a.stat_amount !== null ? String(a.stat_amount) : '', a.stat_amount_note ? `(${a.stat_amount_note})` : ''].filter(Boolean).join(' ');

/** "Special Summons 1 Aqua monster from your GY"; "Cost: discards this card". */
export const humanizeAction = (a: TagAction): string => {
  const phrase = a.is_self || a.name_refs.length ? null : targetPhrase(a.target, (a.quantity ?? 1) > 1);
  const objectText = a.is_self
    ? 'this card'
    : [a.quantity ? String(a.quantity) : '', a.name_refs.length ? quote(a.name_refs) : phrase!.text].filter(Boolean).join(' ');
  const except = phrase?.except ? `, except ${phrase.except}` : '';
  let text: string;
  if (a.verb === 'draw') text = `draws ${a.quantity ?? ''} card${a.quantity === 1 ? '' : 's'}`.replace('  ', ' ');
  else if (a.verb === 'inflict_damage') {
    const who = a.to_side === 'you' ? 'you' : a.to_side === 'either' ? 'both players' : 'your opponent';
    text = `inflicts ${amountText(a) ? `${amountText(a)} damage` : 'damage'} to ${who}`;
  } else if (a.verb === 'gain_lp' || a.verb === 'lose_lp') {
    const who = a.to_side === 'opponent' ? 'your opponent' : a.to_side === 'either' ? 'both players' : 'you';
    const gainOrLose = a.verb === 'gain_lp' ? 'gain' : 'lose';
    text = `${who} ${who === 'your opponent' ? `${gainOrLose}s` : gainOrLose} ${amountText(a) || 'LP'}${amountText(a) ? ' LP' : ''}`;
  } else if (a.verb === 'change_stats' && a.stat) {
    const stat = STAT_WORDS[a.stat];
    const amount = amountText(a);
    const change = {
      gain: `gains ${amount} ${stat}`,
      lose: `loses ${amount} ${stat}`,
      set: `has its ${stat} become ${amount}`,
      halve: `has its ${stat} halved`,
      double: `has its ${stat} doubled`,
    }[a.stat_mode ?? 'gain'];
    text = `${objectText}${except} ${change.replace('  ', ' ')}`;
  } else {
    const phrase = ACTION_PHRASES[a.verb] ?? { verb: humanWord(a.verb) };
    const parts = [phrase.verb, objectText];
    const from = zonesText(a.from_zones, a.from_side);
    if (from) parts.push(`from ${from}`);
    const to = a.to_zones.filter((z) => z !== phrase.implies);
    if (to.length) parts.push(`to ${zonesText(to, a.to_side)}`);
    else if (phrase.suffix) parts.push(phrase.suffix);
    else if (a.to_side && !a.to_zones.length) parts.push(`to ${sidePossessive(a.to_side)} field`);
    text = parts.join(' ') + except;
  }
  return a.is_cost ? `Cost: ${text}` : capitalize(text);
};

/** Event verbs as what happens to the subject: "is sent to the GY". */
const EVENT_PHRASES: Record<string, string> = {
  special_summon: 'is Special Summoned',
  normal_summon: 'is Normal Summoned',
  flip_summon: 'is Flip Summoned',
  set: 'is Set',
  tribute: 'is Tributed',
  add_to_hand: 'is added to the hand',
  send_to_gy: 'is sent to the GY',
  banish: 'is banished',
  destroy: 'is destroyed',
  return_to_hand: 'is returned to the hand',
  return_to_deck: 'is returned to the Deck',
  draw: 'is drawn',
  discard: 'is discarded',
  reveal: 'is revealed',
  negate_activation: 'has its activation negated',
  negate_effect: 'has its effects negated',
  negate_summon: 'has its Summon negated',
  take_control: 'has its control taken',
  attach_material: 'is attached as Xyz Material',
  detach_material: 'is detached',
  equip: 'is equipped',
  place_on_field: 'is placed on the field',
  change_stats: 'has its stats changed',
  change_position: 'has its battle position changed',
  summoned: 'is Summoned',
  flipped: 'is flipped face-up',
  leaves_field: 'leaves the field',
  targeted: 'is targeted',
  attack_declared: 'declares an attack',
  battle_damage: 'causes battle damage',
  battles: 'battles',
  activated: 'is activated',
};

/** "When this card is sent to the GY as a cost for a WATER monster's effect". */
export const humanizeTrigger = (t: TagTrigger): string => {
  const controller = t.subject_side === 'you' ? ' you control' : t.subject_side === 'opponent' ? ' your opponent controls' : '';
  const subject = t.subject_is_self ? 'this card' : `${subjectText(t.subject)}${controller}`;
  const parts = [`When ${subject}`, EVENT_PHRASES[t.event] ?? humanWord(t.event)];
  const from = zonesText(t.from_zones, null);
  if (from) parts.push(`from ${from}`);
  if (t.cause) {
    const by = t.cause_card ? (t.cause_side === 'opponent' ? `your opponent's ${humanTarget(t.cause_card)}` : subjectText(t.cause_card)) : null;
    const possessive = by ? `${by}'s` : null;
    parts.push(
      {
        cost: possessive ? `as a cost for ${possessive} effect` : 'as a cost',
        effect: possessive ? `by ${possessive} effect` : 'by a card effect',
        battle: by ? `by battle with ${by}` : 'by battle',
        material: by ? `as material for ${by}` : 'as material',
      }[t.cause],
    );
  }
  return parts.join(' ');
};
