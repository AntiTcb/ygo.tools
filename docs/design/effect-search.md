# Effect Search (`/search`)

Natural-language search over card effects, e.g. _"cards that can Special Summon Toadally Awesome from the GY"_.

Status: **Design agreed — not yet implemented.**

## Goals

- Answer relational effect questions that keyword/regex search can't: a named card (or a description of one) must be matched against the _constraints_ in other cards' effect text (Level/Rank, Attribute, Type, ATK, archetype, …).
- Support both what a card **does** (actions) and what it **responds to** (triggers) — e.g. find Atlantean-style "if this card is sent to the GY as a cost for a WATER monster's effect" cards.
- Explain every result ("why it matched") and let the user correct the interpreted query.

## Non-goals (v1)

- Languages other than English (`neuron_cards.language = 'en'` only, same as `/database`).

## Approach

**Precompute, then query deterministically.**

1. **Offline tagging:** an LLM reads each card's `effect_text` once and emits structured effect records (actions, triggers, constraints) stored in Supabase.
2. **Query time:** one cheap LLM call turns the user's sentence into a query AST over the same vocabulary. That AST runs deterministically against the stored tags — no LLM per card.

Target constraints reuse the existing `RuleNode` / `Condition` schema (`src/lib/db/cardFilterRule.ts`) and evaluator (`src/lib/db/cardFilterEval.ts`). "Can X be summoned by this effect?" is just evaluating the effect's target `RuleNode` against X's stats.

### Models (Cloudflare Workers AI)

| Job                                          | Model           | Why                                  |
| -------------------------------------------- | --------------- | ------------------------------------ |
| Tagging (offline, accuracy-critical)         | `kimi-k2.6`     | Structured outputs, strong reasoning |
| Query parsing (per search, latency-critical) | `glm-4.7-flash` | Fast, tool calling                   |

Both are **provisional** — confirmed by a bake-off against the gold set (Phase 2), which also covers neuron cost.

## Data model (Supabase, alongside `neuron_cards`)

Schema: `supabase/migrations/20261012190000_effect_search_schema.sql`. Card references are plain `card_id` columns with no FK: `neuron_cards` is keyed on `(id, language)` and owned by the external Neuron importer, so an FK could block or cascade-delete through its reloads. The Workflow cleans up orphans. All tables have RLS on with no policies (service role only).

### Effects (`effect_effects`)

One row per numbered effect on a card. Re-tagging a card replaces its effects (actions/triggers cascade).

| Field                                    | Notes                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `card_id`, `text_source`, `effect_index` | `text_source`: `card` \| `pendulum` (Pendulum Effect box)                                  |
| `effect_type`                            | `ignition` \| `trigger` \| `quick` \| `continuous` \| `activation` (Spell/Trap)            |
| `opt`                                    | `none` \| `soft` \| `hard` \| `per_name_activation` \| `shared_each_effect`                |
| `phase_restriction`                      | `effect_phase[]` (`draw`, `standby`, `main`, `battle`, `damage_step`, `end`); empty = none |
| `turn_restriction`                       | `any` \| `yours` \| `opponents`                                                            |
| `snippet`                                | Source sentence(s), for "why it matched"                                                   |

### Actions (`effect_actions`)

Zero or more per effect, ordered by `seq`.

| Field                                                  | Notes                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `verb_id`                                              | Vocab verb usable as an action (see below)                                                                                               |
| `from_zones`, `to_zones`                               | Zone id arrays — e.g. Tribute from `[hand, field]`, Special Summon from `[hand, gy]` (validated by trigger)                              |
| `from_side`, `to_side`                                 | `you` \| `opponent` \| `either` — whose zone it comes from / who controls the result                                                     |
| `is_cost`                                              | Searchable: "monsters whose **cost** sends a WATER monster to the GY"                                                                    |
| `is_self`                                              | Action applies to this card ("Special Summon this card")                                                                                 |
| `quantity`                                             |                                                                                                                                          |
| `target`                                               | `RuleNode` (jsonb) — constraint on what the action applies to; null = unrestricted                                                       |
| `name_refs`                                            | Card IDs explicitly named as targets (resolved, see below)                                                                               |
| `contextual`, `context_note`                           | Static part is in `target`; flag set when matching also depends on game state ("same Level as the destroyed monster")                    |
| `stat`, `stat_mode`, `stat_amount`, `stat_amount_note` | For `change_stats`: `atk\|def\|level\|rank`, `gain\|lose\|set\|halve\|double`; `stat_amount` only for fixed values, formulas in the note |

### Triggers (`effect_triggers`)

Optional, per effect. Several rows on one effect are alternatives ("If this card is Normal or Special Summoned").

| Field                         | Notes                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `event_verb_id`               | Vocab verb usable as an event (e.g. `send_to_gy`, `summoned`)                                                              |
| `subject_is_self` / `subject` | This card, or a `RuleNode` for the card the event happens to (null = any)                                                  |
| `from_zones`, `subject_side`  | Where it happened from / whose card                                                                                        |
| `cause`                       | `cost` \| `effect` \| `battle` \| `material` (null = any cause)                                                            |
| `cause_side`, `cause_card`    | Whose card caused it; `RuleNode` for that card — e.g. Atlanteans: `send_to_gy`, `cause: cost`, `cause_card: WATER monster` |

### Vocabulary

Source of truth is DB tables, referenced by ID; both prompts are built from them at runtime, so approving a term needs no deploy. `pnpm effect-search:gen-vocab` regenerates `src/lib/effect-search/vocab.generated.ts` for compile-time checks in the UI.

- **`effect_vocab_verbs`** — shared by actions and trigger events; each verb has `usable_as_action` / `usable_as_event` (enforced by trigger).
- **`effect_vocab_zones`**.
- Terms are retired (with a required `replaced_by`), never deleted.

Initial action verbs: `special_summon`, `normal_summon`, `flip_summon`, `set`, `tribute`, `add_to_hand`, `send_to_gy`, `banish`, `destroy`, `return_to_hand`, `return_to_deck`, `draw`, `discard`, `reveal`, `negate_activation`, `negate_effect`, `negate_summon`, `take_control`, `attach_material`, `detach_material`, `equip`, `place_on_field`, `change_stats`, `change_position`, `inflict_damage`, `gain_lp`, `lose_lp`. Most are also usable as events.

Event-only verbs: `summoned`, `flipped`, `leaves_field`, `targeted`, `attack_declared`, `battle_damage`, `activated`.

Initial zones: `deck`, `extra_deck`, `hand`, `field`, `monster_zone`, `spell_trap_zone`, `pendulum_zone`, `field_zone`, `gy`, `banished`, `xyz_material`.

### Name & archetype references

- **Names:** the LLM classifies the _role_ of a quoted name and outputs the quoted string; resolution to a card ID is an exact name match, cross-checked against the referencing card's `neuron_card_relations`. Never fuzzy. (Relations alone aren't enough: they list a card's archetype members as well as named cards.)
- **Archetypes:** `archetype` condition kind in `RuleNode` (`{kind: 'archetype', op: 'in'|'notIn', values}`), evaluated against `card_archetypes(card_id, archetype, source)`. `refresh_card_archetypes()` rebuilds every non-manual row from:
  - `name` — the archetype string (from `ygoprodeck_archetypes`) appears in the card's current name (Neuron's "(Updated from: …)" suffix stripped). Default rule is **word-start**: it must begin at a word boundary, any suffix allowed (matches "Qliphort", "Gem-Knight", "of the Monarchs"; not "Axe Raider" for "Ra"). `card_archetype_rules` overrides the mode per archetype: `word` \| `substring` \| `off`.
  - `relations` — Konami's related-cards list of a card that quotes `"<archetype>"` includes this card, and this card's name contains the archetype string anywhere (catches mid-word members like "CXyz …", "XX-Saber …").
  - `treated_text` — "(This card is [also] always treated as a "X" [and "Y"] card.)" / "still treated as".
  - `treat_table` — name-based archetypes of the card this card's name is treated as (`neuron_card_treat`).
  - `manual` — set in `/admin`, preserved across refreshes.
  - "(This card is not treated as a "X" card.)" suppresses every automatic source.
- **`card_archetypes_unconfirmed`** view: name-only memberships that relations don't back up, for an archetype relations do confirm elsewhere (e.g. "Final Fusion" for "Fusion"). Likely false positives, but relations come from the OCG database, so TCG-only and brand-new cards land there too — reviewed in `/admin`, not auto-dropped.

### Bookkeeping

- `effect_card_tags` — per card: `text_hash` (md5 of effect + pendulum text when tagged), `locked` (hand-corrected; automatic re-tagging skips it), `pending_draft` / `pending_text_hash` (errata on a locked card lands here for review; the corrected version stays live until accepted), `model`, `prompt_version`.
- `effect_tag_queue` view — English cards never tagged or whose text hash changed (locked cards included, flagged, unless a draft for that text already exists).
- `effect_tag_runs` — Workflow runs (`import` \| `vocab` \| `manual` \| `backfill`) with progress; the import cursor is the latest completed `import` run per `db_metadata.source`.
- `effect_vocab_suggestions` — proposed new terms (`kind: verb|zone`, `as_action`/`as_event`, phrases, occurrences, example card IDs, `cluster_key`, status `pending|approved|rejected|merged`).
- `effect_gold_cards` — hand-labelled expected tagger output per card, with the `text_hash` it was written against (target 50–75 tricky cards to start).

## Pipeline

1. **Cron Worker** polls `db_metadata` for an `uploaded = true` version newer than the `effect_tag_runs` cursor for that source, and for newly approved vocab suggestions. Each run also calls `refresh_card_archetypes()`.
2. Starts a **Cloudflare Workflow** that tags changed cards in durable, retryable batches and advances the cursor on completion. The initial backfill is the same Workflow with an empty cursor.
3. Tagger output may include `unmapped: [{phrase, proposed_term, kind}]` → upserted into `effect_vocab_suggestions`. At the end of each run, `glm-4.7-flash` clusters near-duplicate suggestions (e.g. `mill` vs `send_deck_to_gy`).
4. Approving a suggestion re-tags only the example cards plus other cards containing the phrase.
5. **Eval script** scores tagger output against the gold set; gates model/prompt changes before a full re-tag.

## Admin (`/admin`)

**Auth:** Cloudflare Access on `ygo.tools/admin/*`, **and** server-side verification of `Cf-Access-Jwt-Assertion`. This matters because `hooks.server.ts` uses the Supabase service-role key (RLS is bypassed) and Access only covers the custom domain — preview URLs must fail closed.

Features:

1. **Suggestion review** — approve / reject / rename / merge into existing term, with examples and counts.
2. **Vocabulary management** — rename (cascades via ID), retire (requires a replacement term; affected cards queued for re-tag; locked cards flagged instead), edit descriptions (feed the prompts).
3. **Tag inspector** — search a card, see effect text beside parsed effects/actions/triggers.
4. **Tag correction** — hand-edit tags (sets `locked`), "Add to gold set" button.
5. **Run monitor** — recent Workflow runs, progress, failures; manual "re-tag these cards" / "run now".

## Search (`/search`)

**URL:** `/search?q=<natural language>&ast=<encoded AST>` with a zod schema like the other `*SearchParams.schema.ts` routes. Shared links replay `ast` and skip the LLM; editing chips updates only `ast`.

**Query AST** mirrors the tag records, e.g. `{mode: does|responds_to, action: special_summon, from: [gy], target: {card: "Toadally Awesome"} | RuleNode, side?, is_cost?}`.

**Flow:**

1. Parse `q` → AST (`glm-4.7-flash`).
2. Resolve named cards via `search_cards`; low similarity or several close matches → "Did you mean…" before running.
3. Run AST against tags; render tiered results.
4. Unmappable query → fall back to full-text search on effect text with a notice.

**Result tiers** (each result shows tier + matching effect snippet):

1. **Explicit name** — effect names the card.
2. **Property match** — static target `RuleNode` matches the card's stats.
3. **Possibly (depends on game state)** — static part matches but `contextual = true`; `context_note` shown.
4. **Unrestricted** — e.g. "Special Summon 1 monster from your GY".

Self-summons (`is_self`) are included only for the named card itself, labelled "self".

**Interpreted query** is shown as editable chips/form controls so users can correct a bad parse.

**Abuse/cost controls:** Workers Rate Limiting binding (~10 parses/min/IP) + AI Gateway in front of Workers AI for caching identical queries and logs.

## Delivery

Each phase is its own PR.

1. **Schema & vocab** — Supabase migrations (effects, actions, triggers, vocab, suggestions, archetypes, tag runs, gold set), `archetype` `RuleNode` condition kind, seed vocabulary.
2. **Tagger & eval** — tagger prompt, eval script, model bake-off, one-off local backfill via Workers AI REST API. Admin: Access gate + JWT verification, tag inspector, tag correction, gold-set button.
3. **Workflow** — cron on `db_metadata`, hash-based re-tagging, suggestion pipeline + clustering, AI Gateway. Admin: suggestion review, vocab management, run monitor.
4. **`/search`** — query parser, rate limiting, name disambiguation, tiered results with "why", editable AST chips, URL schema.

## Worked example

> "Cards that can Special Summon Toadally Awesome from the GY"

AST: `{mode: does, action: special_summon, from: [gy], target: {card: "Toadally Awesome"}}` → resolve to Toadally Awesome (Rank 2, WATER, Aqua, Xyz, 2200/0). Then:

- Tier 1: action records with `name_refs` containing Toadally Awesome's ID.
- Tier 2: `special_summon` actions with `gy ∈ from` whose `target` RuleNode evaluates true for Toadally Awesome (e.g. "Rank 2 or lower Xyz", "WATER Xyz monster").
- Tier 3: as tier 2 but `contextual`.
- Tier 4: `special_summon` from GY with an empty target.
- Plus Toadally Awesome's own self-revival effect (if any), labelled "self".
