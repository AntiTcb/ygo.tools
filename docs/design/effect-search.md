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

| Job | Model | Why |
| --- | --- | --- |
| Tagging (offline, accuracy-critical) | `kimi-k2.6` | Structured outputs, strong reasoning |
| Query parsing (per search, latency-critical) | `glm-4.7-flash` | Fast, tool calling |

Both are **provisional** — confirmed by a bake-off against the gold set (Phase 2), which also covers neuron cost.

## Data model (Supabase, alongside `neuron_cards`)

### Effects

One row per numbered effect on a card.

| Field | Notes |
| --- | --- |
| `card_id`, `effect_index` | |
| `effect_type` | `ignition` \| `trigger` \| `quick` \| `continuous` \| `activation` (Spell/Trap) |
| `opt` | `none` \| `soft` \| `hard` \| `per_name_activation` \| `shared_each_effect` |
| `phase_restriction`, `turn_restriction` | Coarse enums (e.g. Main Phase only; opponent's turn only) |

### Actions

Zero or more per effect.

| Field | Notes |
| --- | --- |
| `action` | Vocab term ID (see below) |
| `from`, `to` | `zone[]` — e.g. Tribute from `[hand, field]`, Special Summon from `[hand, gy]` |
| `side` | Whose zone / who controls the result: `you` \| `opponent` \| `either` |
| `is_cost` | Searchable: "monsters whose **cost** sends a WATER monster to the GY" |
| `is_self` | Action applies to this card ("Special Summon this card") |
| `quantity` | |
| `target` | `RuleNode` (jsonb) — constraint on what the action applies to |
| `name_refs` | Card IDs explicitly named as targets (resolved, see below) |
| `contextual`, `context_note` | Static part is in `target`; flag set when matching also depends on game state ("same Level as the destroyed monster") |
| `stat_change` | For `change_stats`: `{stat: atk\|def\|level\|rank, mode: gain\|lose\|set\|halve\|double, amount: number \| null, amount_note}` — `amount` only for fixed values |

### Triggers

Optional, per effect; same vocabulary as actions.

| Field | Notes |
| --- | --- |
| `event` | Vocab term (e.g. `send_to_gy`) |
| `subject` | `self` or `RuleNode` |
| `from` | `zone[]` |
| `cause` | Optional, e.g. `{is_cost: true, for_effect_of: RuleNode(WATER monster)}` |

### Vocabulary

Source of truth is DB tables (`effect_vocab_actions`, `effect_vocab_zones`), referenced by ID; both prompts are built from them at runtime, so approving a term needs no deploy. A generated TS type gives compile-time checks in the UI.

Initial actions: `special_summon`, `normal_summon`, `flip_summon`, `set`, `tribute`, `add_to_hand`, `send_to_gy`, `banish`, `destroy`, `return_to_hand`, `return_to_deck`, `draw`, `discard`, `reveal`, `negate_activation`, `negate_effect`, `negate_summon`, `take_control`, `attach_material`, `detach_material`, `equip`, `place_on_field`, `change_stats`, `change_position`, `inflict_damage`, `gain_lp`, `lose_lp`.

Initial zones: `deck`, `extra_deck`, `hand`, `field`, `monster_zone`, `spell_trap_zone`, `pendulum_zone`, `field_zone`, `gy`, `banished`, `xyz_material`.

### Name & archetype references

- **Names:** the LLM classifies the _role_ of a quoted name and outputs the quoted string; resolution to a card ID goes through `neuron_card_relations`, falling back to exact name match. Never fuzzy.
- **Archetypes:** new `archetype` condition kind in `RuleNode`, evaluated against a precomputed `card_archetypes(card_id, archetype)` table built from: name contains the archetype string ∪ `neuron_card_treat` ∪ tagged "always treated as a 'X' card" text.

### Bookkeeping

- `card_tag_runs` — cursor of the last `db_metadata` import version tagged.
- `effect_text_hash` per card — only changed text is re-tagged.
- `locked` per card — hand-corrected tags are skipped by re-tagging. Errata on a locked card produces a pending draft flagged for review; the corrected version stays live until accepted.
- `effect_vocab_suggestions` — proposed new terms (`phrase`, `proposed_term`, `kind: action|zone|event`, count, example card IDs, status).
- Gold set — a DB table of hand-labelled cards (target 50–75 tricky cards to start).

## Pipeline

1. **Cron Worker** polls `db_metadata` for an `uploaded = true` version newer than the `card_tag_runs` cursor, and for newly approved vocab suggestions.
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
