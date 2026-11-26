import type { SearchQueryInput, Tier } from '../../src/lib/effect-search/query';

/**
 * /search regression cases: a request, the query it should parse to, and cards that must (or must not)
 * come back. `include` entries may require a tier at least as good as the one given. Add a case for
 * every false positive or miss someone reports, with a note saying why.
 */
export type SearchCase = {
  id: string;
  request: string;
  query: SearchQueryInput;
  include: (string | { card: string; tier: Tier })[];
  exclude: string[];
  note?: string;
};

export const SEARCH_CASES: SearchCase[] = [
  {
    id: 'toadally-from-gy',
    request: 'cards that can special summon Toadally Awesome from the GY',
    query: { mode: 'does', verb: 'special_summon', from_zones: ['gy'], target: { card: 'Toadally Awesome' } },
    include: [{ card: 'Xyz Revive Splash', tier: 'property' }, 'Monster Reborn', 'Call of the Haunted'],
    exclude: ['Ocean of Regeneration', 'Marincess Coral Anemone'],
    note: 'Ocean of Regeneration only summons WATER monsters with 1000 or less ATK; Coral Anemone only Cyberse (reported false positives).',
  },
  {
    id: 'dark-magician-search',
    request: 'cards that add Dark Magician from the deck to the hand',
    query: { mode: 'does', verb: 'add_to_hand', from_zones: ['deck'], target: { card: 'Dark Magician' } },
    include: ['Dark Magical Circle', 'Illusion Magic'],
    exclude: ["Magician's Rod"],
    note: "Magician's Rod adds a Spell/Trap that mentions Dark Magician, not Dark Magician itself.",
  },
  {
    id: 'trap-negate-activation',
    request: 'traps that negate the activation of a card',
    query: { mode: 'does', verb: 'negate_activation', card_filter: { card_types: ['trap'] } },
    include: ['Solemn Judgment', 'Solemn Strike', 'Magic Jammer', 'Seven Tools of the Bandit'],
    exclude: ['Infinite Impermanence'],
    note: 'Infinite Impermanence negates effects, not activations.',
  },
  {
    id: 'mill',
    request: 'cards that send a card from the deck to the graveyard',
    query: { mode: 'does', verb: 'send_to_gy', from_zones: ['deck'] },
    include: ['Foolish Burial', 'Armageddon Knight', 'Dragon Shrine'],
    exclude: ['Card Destruction', 'Pot of Desires'],
    note: 'Card Destruction discards the hand; Pot of Desires banishes from the Deck.',
  },
  {
    id: 'banish-opponent-gy',
    request: "cards that banish from the opponent's graveyard",
    query: { mode: 'does', verb: 'banish', from_zones: ['gy'], from_side: 'opponent' },
    include: ['Called by the Grave', 'D.D. Crow'],
    exclude: ['Crossout Designator', 'Bottomless Trap Hole'],
  },
  {
    id: 'destroyed-by-battle',
    request: 'monsters that trigger when they are destroyed by battle',
    query: { mode: 'responds_to', verb: 'destroy', cause: 'battle', subject_is_self: true },
    include: ['Mystic Tomato', 'Giant Rat', 'Shining Angel'],
    exclude: ['Sangan', 'Marshmallon'],
    note: 'Sangan triggers on being sent to the GY from the field; Marshmallon cannot be destroyed by battle.',
  },
  {
    id: 'sent-to-gy',
    request: 'monsters that trigger when sent to the graveyard',
    query: { mode: 'responds_to', verb: 'send_to_gy', subject_is_self: true },
    include: ['Sangan', 'Witch of the Black Forest'],
    exclude: ['Glow-Up Bulb'],
  },
  {
    id: 'draw',
    request: 'cards that draw cards',
    query: { mode: 'does', verb: 'draw' },
    include: ['Pot of Greed', 'Upstart Goblin', 'Graceful Charity'],
    exclude: ['Foolish Burial'],
  },
  {
    id: 'destroy-spell-trap',
    request: 'cards that destroy a spell or trap',
    query: { mode: 'does', verb: 'destroy', target: { card_types: ['spell', 'trap'] } },
    include: [{ card: 'Mystical Space Typhoon', tier: 'property' }, { card: 'Twin Twisters', tier: 'property' }, "Harpie's Feather Duster"],
    exclude: ['Raigeki', 'Dark Hole'],
    note: '"Destroy 1 Spell/Trap" fits a Spell/Trap query; it is not an "any card" match.',
  },
  {
    id: 'warrior-search',
    request: 'cards that add a level 4 or lower warrior from the deck to the hand',
    query: {
      mode: 'does',
      verb: 'add_to_hand',
      from_zones: ['deck'],
      target: { card_types: ['monster'], races: ['Warrior'], level: { op: 'lte', value: 4 } },
    },
    include: [{ card: 'Reinforcement of the Army', tier: 'property' }],
    exclude: ['Emergency Teleport'],
    note: 'v4 tags called Warrior an archetype and added Rank/Link limits.',
  },
  {
    id: 'self-summon-from-hand',
    request: 'level 4 or lower monsters that special summon themselves from the hand',
    query: {
      mode: 'does',
      verb: 'special_summon',
      from_zones: ['hand'],
      target: { card: '__self__' },
      card_filter: { card_types: ['monster'], level: { op: 'lte', value: 4 } },
    },
    include: ['Photon Thrasher', 'Speedroid Terrortop'],
    exclude: ['Cyber Dragon'],
    note: 'Cyber Dragon is Level 5.',
  },
  {
    id: 'dragon-from-deck',
    request: 'cards that special summon a dragon from the deck',
    query: { mode: 'does', verb: 'special_summon', from_zones: ['deck'], target: { card_types: ['monster'], races: ['Dragon'] } },
    include: [{ card: 'Guardragon Elpy', tier: 'property' }],
    exclude: ['Monster Reborn', 'Dragon Ravine'],
  },
  {
    id: 'discard-cost',
    request: 'cards that discard as a cost',
    query: { mode: 'does', verb: 'discard', is_cost: true },
    include: ['Ash Blossom & Joyous Spring', 'Lightning Vortex', 'Magic Jammer'],
    exclude: ['Card Destruction', 'Solemn Judgment'],
    note: "Card Destruction's discard is the effect, not a cost.",
  },
  {
    id: 'negate-effect',
    request: 'cards that negate monster effects',
    query: { mode: 'does', verb: 'negate_effect' },
    include: ['Effect Veiler', 'Infinite Impermanence', 'Breakthrough Skill'],
    exclude: ['Pot of Greed'],
  },
  {
    id: 'gy-to-deck',
    request: 'cards that shuffle cards from the graveyard into the deck',
    query: { mode: 'does', verb: 'return_to_deck', from_zones: ['gy'] },
    include: ['Pot of Avarice', 'A Feather of the Phoenix'],
    exclude: ['Magical Stone Excavation'],
  },
  {
    id: 'negate-summon',
    request: 'cards that negate a summon',
    query: { mode: 'does', verb: 'negate_summon' },
    include: ['Solemn Warning', 'Black Horn of Heaven'],
    exclude: ['Effect Veiler'],
  },
  {
    id: 'take-control',
    request: "cards that take control of an opponent's monster",
    query: { mode: 'does', verb: 'take_control' },
    include: ['Change of Heart', 'Brain Control'],
    exclude: ['Raigeki'],
  },
  {
    id: 'summoned-by-snake-eye-spoils',
    request: 'Cards that can be summoned by Original Sinful Spoils - Snake-Eye',
    query: { mode: 'affected_by', verb: 'special_summon', source: { card: 'Original Sinful Spoils - Snake-Eye' } },
    include: [{ card: 'Snake-Eye Ash', tier: 'property' }, 'Snake-Eyes Poplar'],
    exclude: ['Infernoid Evil', 'Diabellstar the Black Witch', 'Blue-Eyes White Dragon'],
    note: 'It summons a Level 1 FIRE monster from the hand or Deck: not Fusion Monsters (Infernoid Evil), nor Diabellstar (reported: no results).',
  },
  {
    id: 'summoned-by-partial-name',
    request: 'Cards that can be summoned by Mixousia',
    query: { mode: 'affected_by', verb: 'special_summon', source: { card: 'Mixousia' } },
    include: ['Elemental HERO Flame Wingman'],
    exclude: ['Blue-Eyes White Dragon'],
    note: '"Mixousia" is the only card starting with that name (Mixousia the Confounder): it Fusion Summons any Fusion Monster (reported: no results).',
  },
  {
    id: 'just-cards',
    request: 'Level 1 FIRE monsters',
    query: { mode: 'cards', card_filter: { card_types: ['monster'], attributes: ['FIRE'], level: { op: 'eq', value: 1 } } },
    include: ['Snake-Eye Ash', 'Infernoid Evil'],
    exclude: ['Blue-Eyes White Dragon', 'Diabellstar the Black Witch'],
    note: 'No effect asked for: just the cards (reported: no results).',
  },
  {
    id: 'send-level-2-aqua',
    request: 'Send Level 2 Aqua monsters to the GY',
    query: { mode: 'does', verb: 'send_to_gy', target: { card_types: ['monster'], races: ['Aqua'], level: { op: 'eq', value: 2 } } },
    include: ['Swap Frog', 'Foolish Burial'],
    exclude: ['Dragon Shrine'],
    note: 'Reported: the parse dropped the Level 2 Aqua target and returned every card that sends from the Deck.',
  },
  {
    id: 'draw-2',
    request: 'cards that draw 2',
    query: { mode: 'does', verb: 'draw' },
    include: ['Pot of Greed', 'Graceful Charity'],
    exclude: [],
    note: 'The number of cards is not a query field; it was parsed as "draw itself".',
  },
  {
    id: 'like-called-by-the-grave',
    request: 'cards like called by the grave',
    query: { mode: 'does', verb: 'banish', from_zones: ['gy'], from_side: 'opponent' },
    include: ['Called by the Grave', 'D.D. Crow'],
    exclude: ['Pot of Greed'],
    note: 'Was unsupported: the parser had only the card name. It now gets the text of cards a request names.',
  },
];
