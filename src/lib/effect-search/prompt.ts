import { ATTRIBUTE_NAMES, CARD_TYPES, MONSTER_KINDS, RACE_NAMES, SPELL_TRAP_TYPES, type TagOutputInput } from './tagSchema';

/** Bump whenever the prompt or labelling conventions change; stored on each tagged card and run. */
export const TAG_PROMPT_VERSION = 'v3';

export type VocabTerm = { term: string; description: string; usable_as_action?: boolean; usable_as_event?: boolean };

export type PromptVocab = { verbs: VocabTerm[]; zones: VocabTerm[] };

/** The card as shown to the tagger. */
export type TaggerCard = {
  name: string;
  /** e.g. "Effect Monster · Level 3 · FIRE · Zombie · ATK 0 / DEF 1800" */
  typeLine: string;
  effectText: string | null;
  pendulumText: string | null;
};

export type TagExample = { card: TaggerCard; output: TagOutputInput };

/** Worked examples shown to the tagger; also the canonical labelling conventions for the gold set. */
export const TAG_EXAMPLES: TagExample[] = [
  {
    card: {
      name: 'Toadally Awesome',
      typeLine: 'Xyz/Effect Monster · Rank 2 · WATER · Aqua · ATK 2200 / DEF 0',
      effectText:
        '2 Level 2 Aqua monsters\nOnce per turn, during the Standby Phase: You can detach 1 material from this card; Special Summon 1 "Frog" monster from your Deck. Once per turn, when your opponent activates a Spell/Trap Card, or monster effect (Quick Effect): You can send 1 Aqua monster from your hand or face-up field to the GY; negate the activation, and if you do, destroy that card, then you can Set it to your field. If this card is sent to the GY: You can target 1 WATER monster in your GY; add it to your hand.',
      pendulumText: null,
    },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet:
            'Once per turn, during the Standby Phase: You can detach 1 material from this card; Special Summon 1 "Frog" monster from your Deck.',
          effect_type: 'trigger',
          opt: 'soft',
          phase_restriction: ['standby'],
          actions: [
            { verb: 'detach_material', from_zones: ['xyz_material'], is_cost: true, quantity: 1 },
            { verb: 'special_summon', from_zones: ['deck'], from_side: 'you', quantity: 1, target: { archetypes: ['Frog'] } },
          ],
        },
        {
          effect_index: 1,
          snippet:
            'Once per turn, when your opponent activates a Spell/Trap Card, or monster effect (Quick Effect): You can send 1 Aqua monster from your hand or face-up field to the GY; negate the activation, and if you do, destroy that card, then you can Set it to your field.',
          effect_type: 'quick',
          opt: 'soft',
          triggers: [{ event: 'activated', subject: { card_types: ['spell', 'trap', 'monster'] }, subject_side: 'opponent' }],
          actions: [
            { verb: 'send_to_gy', from_zones: ['hand', 'field'], from_side: 'you', is_cost: true, quantity: 1, target: { races: ['Aqua'] } },
            { verb: 'negate_activation' },
            { verb: 'destroy', quantity: 1 },
            { verb: 'set', to_zones: ['field'], to_side: 'you', quantity: 1 },
          ],
        },
        {
          effect_index: 2,
          snippet: 'If this card is sent to the GY: You can target 1 WATER monster in your GY; add it to your hand.',
          effect_type: 'trigger',
          triggers: [{ event: 'send_to_gy', subject_is_self: true }],
          actions: [
            { verb: 'add_to_hand', from_zones: ['gy'], from_side: 'you', quantity: 1, target: { card_types: ['monster'], attributes: ['WATER'] } },
          ],
        },
      ],
    },
  },
  {
    card: {
      name: 'Atlantean Marksman',
      typeLine: 'Effect Monster · Level 3 · WATER · Sea Serpent · ATK 1400 / DEF 0',
      effectText:
        'When this card inflicts Battle Damage to your opponent: You can Special Summon 1 Level 4 or lower "Atlantean" Sea Serpent-Type monster from your Deck, except "Atlantean Marksman". When this card is sent to the Graveyard to activate a WATER monster\'s effect: Target 1 Set card your opponent controls; destroy that target.',
      pendulumText: null,
    },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet:
            'When this card inflicts Battle Damage to your opponent: You can Special Summon 1 Level 4 or lower "Atlantean" Sea Serpent-Type monster from your Deck, except "Atlantean Marksman".',
          effect_type: 'trigger',
          triggers: [{ event: 'battle_damage', subject_is_self: true }],
          actions: [
            {
              verb: 'special_summon',
              from_zones: ['deck'],
              from_side: 'you',
              quantity: 1,
              target: { level: { op: 'lte', value: 4 }, archetypes: ['Atlantean'], races: ['Sea Serpent'], exclude_names: ['Atlantean Marksman'] },
            },
          ],
        },
        {
          effect_index: 1,
          snippet:
            "When this card is sent to the Graveyard to activate a WATER monster's effect: Target 1 Set card your opponent controls; destroy that target.",
          effect_type: 'trigger',
          triggers: [{ event: 'send_to_gy', subject_is_self: true, cause: 'cost', cause_card: { card_types: ['monster'], attributes: ['WATER'] } }],
          actions: [{ verb: 'destroy', from_zones: ['field'], from_side: 'opponent', quantity: 1 }],
        },
      ],
    },
  },
  {
    card: { name: 'Monster Reborn', typeLine: 'Normal Spell', effectText: 'Target 1 monster in either GY; Special Summon it.', pendulumText: null },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet: 'Target 1 monster in either GY; Special Summon it.',
          effect_type: 'activation',
          actions: [{ verb: 'special_summon', from_zones: ['gy'], from_side: 'either', quantity: 1 }],
        },
      ],
    },
  },
  {
    card: {
      name: 'Ash Blossom & Joyous Spring',
      typeLine: 'Tuner/Effect Monster · Level 3 · FIRE · Zombie · ATK 0 / DEF 1800',
      effectText:
        'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect.\n●Add a card from the Deck to the hand.\n●Special Summon from the Deck.\n●Send a card from the Deck to the GY.\nYou can only use this effect of "Ash Blossom & Joyous Spring" once per turn.',
      pendulumText: null,
    },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet:
            'When a card or effect is activated that includes any of these effects (Quick Effect): You can discard this card; negate that effect. ●Add a card from the Deck to the hand. ●Special Summon from the Deck. ●Send a card from the Deck to the GY.',
          effect_type: 'quick',
          opt: 'hard',
          triggers: [{ event: 'activated', subject_side: 'either' }],
          actions: [
            { verb: 'discard', from_zones: ['hand'], is_cost: true, is_self: true, quantity: 1 },
            {
              verb: 'negate_effect',
              contextual: true,
              context_note: 'only effects that search, Special Summon from the Deck, or send from the Deck to the GY',
            },
          ],
        },
      ],
    },
  },
  {
    card: {
      name: 'Swamp Battleguard',
      typeLine: 'Effect Monster · Level 5 · EARTH · Warrior · ATK 1800 / DEF 1500',
      effectText: 'Gains 500 ATK for each "Lava Battleguard" you control.',
      pendulumText: null,
    },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet: 'Gains 500 ATK for each "Lava Battleguard" you control.',
          effect_type: 'continuous',
          actions: [
            { verb: 'change_stats', is_self: true, stat: 'atk', stat_mode: 'gain', stat_amount_note: '500 for each "Lava Battleguard" you control' },
          ],
        },
      ],
    },
  },
  {
    card: {
      name: 'Beastking of the Swamps',
      typeLine: 'Effect Monster · Level 4 · WATER · Aqua · ATK 1000 / DEF 1100',
      effectText:
        'You can substitute this card for any 1 Fusion Material Monster. When you do this, the other Fusion Material Monster(s) must be the correct one(s).',
      pendulumText: null,
    },
    output: {
      effects: [
        {
          effect_index: 0,
          snippet:
            'You can substitute this card for any 1 Fusion Material Monster. When you do this, the other Fusion Material Monster(s) must be the correct one(s).',
          effect_type: 'continuous',
          actions: [],
        },
      ],
      unmapped: [
        {
          kind: 'verb',
          as_action: true,
          proposed_term: 'fusion_substitute',
          description: 'This card can be used as a substitute for a named Fusion Material',
          phrase: 'substitute this card for any 1 Fusion Material Monster',
        },
      ],
    },
  },
];

const termList = (terms: VocabTerm[]) => terms.map((t) => `- ${t.term}: ${t.description}`).join('\n');

const formatCard = (card: TaggerCard): string =>
  [
    `Name: ${card.name}`,
    `Card: ${card.typeLine}`,
    `Card text:\n${card.effectText?.trim() || '(none)'}`,
    ...(card.pendulumText?.trim() ? [`Pendulum Effect text:\n${card.pendulumText.trim()}`] : []),
  ].join('\n');

/** Static per vocabulary version, so providers can cache it across cards. */
export const buildSystemPrompt = (vocab: PromptVocab): string => {
  const actionVerbs = vocab.verbs.filter((v) => v.usable_as_action);
  const eventVerbs = vocab.verbs.filter((v) => v.usable_as_event);
  return `You convert Yu-Gi-Oh! card text into structured effect data for a card search engine. Read the card text the way a judge would, using Problem-Solving Card Text (PSCT) conventions, and output only JSON matching the schema.

## What counts as an effect
- Each separately activated or applied effect in the text box is one entry in "effects", numbered from 0 in the order printed ("effect_index"). Effects from the "Pendulum Effect text" section MUST have text_source "pendulum" and are numbered from 0 separately; card-text effects have text_source "card".
- "Activate 1 of these effects" / "You can activate 1 of these effects" followed by bullet points (●) is ONE effect: put the actions of every bullet in that one effect, in printed order. Bullets that list what an effect responds to (Ash Blossom) are also part of the one effect.
- NOT effects: Fusion/Synchro/Xyz/Link material lines, bare summoning restrictions ("Cannot be Normal Summoned/Set", "You can only Special Summon "X" once per turn", "You cannot Normal Summon/Set the turn you Special Summon this card"), flavor text of Normal Monsters, once-per-turn clauses (those set "opt"), and restrictions a Spell/Trap places on its own activator ("You cannot Summon other monsters the turn you activate this card").
- Inherent summoning procedures ARE recorded, with effect_type "procedure": "If only your opponent controls a monster, you can Special Summon this card (from your hand)." -> a special_summon action with is_self true and from_zones ["hand"]. Text that says how the card must be Special Summoned ("Must first be Special Summoned (from your hand) to your opponent's field by Tributing 2 monsters they control", "Must be Special Summoned (from your Extra Deck) by sending the above cards you control to the GY") is also a procedure. Anything you must do as part of the procedure is an is_cost action.
- Effects that only prevent or protect ("Cannot be used as Synchro Material", "cannot be destroyed by battle", "your opponent's monsters cannot declare an attack") are still effects: record them with the actions that fit (often none), and propose terms in "unmapped" for protections and other things worth searching for.
- A Normal Monster or a card with no effects has "effects": [].
- "snippet": the exact sentence(s) of that effect, copied from the card text.

## Effect fields
- effect_type: "activation" for the effect of activating a Spell/Trap Card; "trigger" for effects that activate when something happens ("If/When ...:", FLIP effects, "during the Standby Phase:"); "quick" for Quick Effects (marked "(Quick Effect)", or a Spell Speed 2 monster effect activated in response to something); "ignition" for monster effects you activate in your Main Phase without a trigger; "continuous" for effects that apply without activating (no ":" or ";" activation structure); "procedure" for inherent summoning procedures (see above).
- opt: "soft" = "Once per turn" written on the effect; "hard" = "You can only use this effect of "X" once per turn"; "shared_each_effect" = "You can only use each effect of "X" once per turn"; "per_name_activation" = "You can only activate 1 "X" per turn"; otherwise "none". When several clauses apply, pick the most restrictive.
- phase_restriction: phases the effect is limited to ("during the Main Phase" -> ["main"]). Empty when unrestricted.
- turn_restriction: "yours" / "opponents" when limited to one player's turn, else "any".

## Triggers (what an effect responds to)
- For any effect whose condition is an event: "trigger" and "quick" effects, Spell/Trap activations with a "When/If ...:" condition (Mirror Force: "When an opponent's monster declares an attack:"), and "continuous" effects that apply when something happens ("When this card leaves the field, destroy that monster"). Several triggers on one effect are alternatives ("If this card is Normal or Special Summoned" = two triggers).
- event: one of the event verbs. subject_is_self: the event happens to this card. Otherwise "subject" is a target describing the card the event happens to (null = any card).
- from_zones: where the subject was ("sent from the hand or field to the GY" -> ["hand", "field"]).
- cause: "cost" (sent/banished/etc. as a cost), "effect" (by a card effect), "battle", "material" (used as material). cause_side / cause_card describe whose card caused it and what kind ("to activate a WATER monster's effect" -> cause "cost", cause_card {card_types: ["monster"], attributes: ["WATER"]}).
- Phase-start triggers ("during the Standby Phase:") have no trigger entries; use phase_restriction.

## Actions (what an effect does)
- One entry per distinct action, in printed order. Everything before ";" is a cost: set is_cost true. Targeting itself is not an action.
- verb: one of the action verbs. If an action fits no verb ("you win the Duel", "this card's name becomes...", "negate the attack", "excavate"), leave it out of "actions" and add an "unmapped" entry proposing a new term instead; never force it onto a wrong verb. Summoning Tokens is special_summon (with no from_zones) plus an unmapped "special_summon_token" proposal.
- from_zones: where the affected card comes from. to_zones: only when the destination is not implied by the verb (add_to_hand implies hand, send_to_gy implies GY, banish implies banished, summons imply the field); e.g. return_to_deck to the Extra Deck, place_on_field into a Pendulum Zone, set to the field.
- from_side: whose zone it comes from ("your GY" -> you, "your opponent's GY" -> opponent, "either GY" / "on the field" -> either). to_side: only when the result is controlled by a specific player that matters ("Set it to your field" -> you; "Special Summon ... to your opponent's field" -> opponent). For draw, inflict_damage, gain_lp and lose_lp, to_side is the affected player ("Inflict 800 damage to your opponent" -> opponent; "Take 1000 damage" -> you; "Both players draw" -> either).
- is_self: the action affects this card itself ("Special Summon this card", "discard this card"). Monster text with no stated subject is about this card: "Gains 500 ATK for each..." / "Cannot be destroyed by battle" / "Return this face-up card to the hand" -> is_self true.
- quantity: the number printed ("1", "up to 2" -> 2); null for "all"/unspecified.
- target: restrictions on what the action can affect, beyond what the verb implies (summons imply a monster, so "Special Summon 1 monster" has target null). null = unrestricted. Use the target fields; values within one list are alternatives, different fields must all hold; use "any_of" for "X or Y" across different fields.
  - Quoted names followed by "card(s)", "monster(s)", "Spell", "Trap" are archetypes ("archetypes": ["Frog"]); a quoted name standing alone is a specific card: put it in the action's "name_refs" ("Special Summon 1 "Toadally Awesome"" -> name_refs ["Toadally Awesome"]). "except "X"" -> exclude_names.
  - "level" is for Level; "rank" is for Rank (Xyz); "link_rating" for Link Rating. "Level 4 or lower" -> {"op": "lte", "value": 4}.
  - monster_kinds: card frames/abilities ("Xyz Monster" -> ["xyz"], "Tuner" -> ["tuner"]); "non-Tuner" -> exclude_monster_kinds ["tuner"].
  - Allowed values: card_types ${JSON.stringify(CARD_TYPES)}; attributes ${JSON.stringify(ATTRIBUTE_NAMES)}; races ${JSON.stringify(RACE_NAMES)}; monster_kinds ${JSON.stringify(MONSTER_KINDS)}; spell_trap_types ${JSON.stringify(SPELL_TRAP_TYPES)}.
- contextual: true when what the action can affect also depends on game state that the target can't express ("a monster with the same Level as the destroyed monster", "monsters that were banished this turn", "a monster that was used as material"); put the static part in target and explain the rest in context_note. Battle position and face-up/face-down qualifiers ("face-up monster", "Attack Position monsters", "Set card") are ignored: they are not contextual.
- Actions on "that card"/"that monster" (the card a trigger is about, e.g. "negate the activation, and if you do, destroy that card") have target null and are not contextual.
- Cards on the field: from_zones ["field"] unless the text names a specific zone ("in a Monster Zone" -> ["monster_zone"]); this also applies to non-moving actions (destroy, negate_effect, change_stats, change_position, take_control) on cards on the field.
- change_stats: set stat ("atk"/"def"/"level"/"rank"), stat_mode ("gain"/"lose"/"set"/"halve"/"double"); stat_amount only for a fixed number, otherwise describe the formula in stat_amount_note.
- inflict_damage, gain_lp, lose_lp: stat_amount is the fixed amount ("Inflict 800 damage" -> 800; "Pay 1000 LP" -> 1000), otherwise stat_amount_note ("half your LP"). Leave stat and stat_mode null.

## Vocabulary
Action verbs:
${termList(actionVerbs)}

Event verbs (for triggers):
${termList(eventVerbs)}

Zones:
${termList(vocab.zones)}

## Unmapped
"unmapped" lists actions/events/zones in the text that the vocabulary can't express: kind "verb" or "zone", as_action / as_event for verbs, a snake_case proposed_term, a one-line description, and the phrase from the card. Leave it empty when everything fits.

## Examples
${TAG_EXAMPLES.map((ex) => `${formatCard(ex.card)}\nOutput:\n${JSON.stringify(ex.output)}`).join('\n\n')}`;
};

export const buildUserPrompt = (card: TaggerCard): string => `${formatCard(card)}\nOutput:`;
