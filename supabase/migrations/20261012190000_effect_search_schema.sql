-- Effect search (/search), phase 1: tag storage, vocabulary, archetypes, runs, gold set.
-- Design: docs/design/effect-search.md
--
-- Card references are plain `card_id bigint` (no FK): `neuron_cards` is keyed on (id, language) and is
-- owned by the external Neuron importer, so an FK could block or cascade-delete through its reloads.
-- Orphaned tags are cleaned up by the tagging Workflow instead.
--
-- All tables have RLS enabled with no policies: only the service role (used server-side) can access them.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.effect_type as enum ('ignition', 'trigger', 'quick', 'continuous', 'activation');

create type public.effect_opt as enum ('none', 'soft', 'hard', 'per_name_activation', 'shared_each_effect');

create type public.effect_phase as enum ('draw', 'standby', 'main', 'battle', 'damage_step', 'end');

create type public.effect_turn as enum ('any', 'yours', 'opponents');

create type public.effect_side as enum ('you', 'opponent', 'either');

-- Which printed text box an effect came from.
create type public.effect_text_source as enum ('card', 'pendulum');

create type public.effect_stat as enum ('atk', 'def', 'level', 'rank');

create type public.effect_stat_mode as enum ('gain', 'lose', 'set', 'halve', 'double');

-- What caused a trigger's event (null on the trigger = any cause).
create type public.effect_trigger_cause as enum ('cost', 'effect', 'battle', 'material');

create type public.effect_vocab_kind as enum ('verb', 'zone');

create type public.effect_suggestion_status as enum ('pending', 'approved', 'rejected', 'merged');

create type public.effect_tag_run_kind as enum ('import', 'vocab', 'manual', 'backfill');

create type public.effect_tag_run_status as enum ('running', 'completed', 'failed');

create type public.card_archetype_source as enum ('name', 'relations', 'treated_text', 'treat_table', 'manual');

-- How an archetype string must appear in a card name to count as membership.
create type public.card_archetype_match as enum ('word_start', 'word', 'substring', 'off');

-- ---------------------------------------------------------------------------
-- Vocabulary (source of truth for both LLM prompts)
-- ---------------------------------------------------------------------------

-- Verbs are shared by actions and trigger events; a verb says which roles it may play.
create table public.effect_vocab_verbs (
  id smallint generated always as identity primary key,
  term text not null unique check (term ~ '^[a-z][a-z0-9_]*$'),
  description text not null,
  usable_as_action boolean not null default true,
  usable_as_event boolean not null default false,
  retired_at timestamptz,
  replaced_by smallint references public.effect_vocab_verbs (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (usable_as_action or usable_as_event),
  check ((retired_at is null) = (replaced_by is null))
);

create table public.effect_vocab_zones (
  id smallint generated always as identity primary key,
  term text not null unique check (term ~ '^[a-z][a-z0-9_]*$'),
  description text not null,
  retired_at timestamptz,
  replaced_by smallint references public.effect_vocab_zones (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((retired_at is null) = (replaced_by is null))
);

-- Array columns can't carry FKs; validate zone ids on write instead.
create function public.effect_assert_zone_ids (zone_ids smallint[]) returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  missing smallint;
begin
  select z into missing
  from unnest(coalesce(zone_ids, '{}')) as z
  where not exists (select 1 from public.effect_vocab_zones v where v.id = z)
  limit 1;
  if missing is not null then
    raise exception 'unknown effect zone id %', missing using errcode = 'foreign_key_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-card tagging state
-- ---------------------------------------------------------------------------

create table public.effect_card_tags (
  card_id bigint primary key,
  -- md5 of effect_text || pendulum_text at tagging time; see effect_tag_queue.
  text_hash text not null,
  -- Hand-corrected in /admin; automatic re-tagging skips locked cards.
  locked boolean not null default false,
  -- Errata on a locked card: the re-tag lands here for review instead of replacing live tags.
  pending_draft jsonb,
  pending_text_hash text,
  model text,
  prompt_version text,
  tagged_at timestamptz not null default now(),
  check ((pending_draft is null) = (pending_text_hash is null))
);

create table public.effect_effects (
  id bigint generated always as identity primary key,
  card_id bigint not null references public.effect_card_tags (card_id) on delete cascade,
  text_source public.effect_text_source not null default 'card',
  effect_index smallint not null check (effect_index >= 0),
  effect_type public.effect_type not null,
  opt public.effect_opt not null default 'none',
  phase_restriction public.effect_phase[] not null default '{}',
  turn_restriction public.effect_turn not null default 'any',
  -- The sentence(s) this effect was parsed from, for "why it matched".
  snippet text not null,
  unique (card_id, text_source, effect_index)
);

create index effect_effects_card_id_idx on public.effect_effects (card_id);

create table public.effect_actions (
  id bigint generated always as identity primary key,
  effect_id bigint not null references public.effect_effects (id) on delete cascade,
  -- Denormalized for search queries.
  card_id bigint not null,
  seq smallint not null check (seq >= 0),
  verb_id smallint not null references public.effect_vocab_verbs (id) on update cascade,
  from_zones smallint[] not null default '{}',
  to_zones smallint[] not null default '{}',
  -- Whose zone the action takes from / who ends up controlling the result.
  from_side public.effect_side,
  to_side public.effect_side,
  is_cost boolean not null default false,
  is_self boolean not null default false,
  quantity smallint check (quantity > 0),
  -- RuleNode (src/lib/db/cardFilterRule.ts) for what the action can apply to; null = unrestricted.
  target jsonb,
  -- Card ids named in quotes as targets (resolved via exact name match / neuron_card_relations).
  name_refs bigint[] not null default '{}',
  contextual boolean not null default false,
  context_note text,
  stat public.effect_stat,
  stat_mode public.effect_stat_mode,
  -- Only for fixed values; formulas go in stat_amount_note.
  stat_amount integer,
  stat_amount_note text,
  unique (effect_id, seq),
  check (contextual or context_note is null),
  check ((stat is null) = (stat_mode is null)),
  check (stat is not null or (stat_amount is null and stat_amount_note is null))
);

create index effect_actions_card_id_idx on public.effect_actions (card_id);
create index effect_actions_verb_id_idx on public.effect_actions (verb_id);
create index effect_actions_from_zones_idx on public.effect_actions using gin (from_zones);
create index effect_actions_to_zones_idx on public.effect_actions using gin (to_zones);
create index effect_actions_name_refs_idx on public.effect_actions using gin (name_refs);

create table public.effect_triggers (
  id bigint generated always as identity primary key,
  effect_id bigint not null references public.effect_effects (id) on delete cascade,
  card_id bigint not null,
  -- Several rows on one effect are alternatives ("If this card is Normal or Special Summoned").
  event_verb_id smallint not null references public.effect_vocab_verbs (id) on update cascade,
  subject_is_self boolean not null default false,
  -- RuleNode for the card the event happens to, when not this card; null = any card.
  subject jsonb,
  from_zones smallint[] not null default '{}',
  subject_side public.effect_side,
  cause public.effect_trigger_cause,
  cause_side public.effect_side,
  -- RuleNode for the card whose effect/summon caused the event (e.g. a WATER monster's effect).
  cause_card jsonb,
  check (not (subject_is_self and subject is not null))
);

create index effect_triggers_card_id_idx on public.effect_triggers (card_id);
create index effect_triggers_event_verb_id_idx on public.effect_triggers (event_verb_id);

create function public.effect_check_row_zones () returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.effect_assert_zone_ids(new.from_zones);
  if tg_table_name = 'effect_actions' then
    perform public.effect_assert_zone_ids(new.to_zones);
  end if;
  return new;
end;
$$;

create trigger effect_actions_check_zones before insert or update of from_zones, to_zones on public.effect_actions
for each row execute function public.effect_check_row_zones ();

create trigger effect_triggers_check_zones before insert or update of from_zones on public.effect_triggers
for each row execute function public.effect_check_row_zones ();

-- Verbs must be used in a role they allow.
create function public.effect_check_verb_role () returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ok boolean;
begin
  if tg_table_name = 'effect_actions' then
    select usable_as_action into ok from public.effect_vocab_verbs where id = new.verb_id;
  else
    select usable_as_event into ok from public.effect_vocab_verbs where id = new.event_verb_id;
  end if;
  if not coalesce(ok, false) then
    raise exception 'verb not usable as % here', case when tg_table_name = 'effect_actions' then 'an action' else 'an event' end;
  end if;
  return new;
end;
$$;

create trigger effect_actions_check_verb before insert or update of verb_id on public.effect_actions
for each row execute function public.effect_check_verb_role ();

create trigger effect_triggers_check_verb before insert or update of event_verb_id on public.effect_triggers
for each row execute function public.effect_check_verb_role ();

-- English cards whose current text differs from what was last tagged (or were never tagged).
create view public.effect_tag_queue with (security_invoker = true) as
select
  c.id as card_id,
  md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, '')) as text_hash,
  t.card_id is null as never_tagged,
  coalesce(t.locked, false) as locked
from public.neuron_cards c
left join public.effect_card_tags t on t.card_id = c.id
where c.language = 'en'
  and (t.card_id is null or t.text_hash <> md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, '')))
  and (t.pending_text_hash is null or t.pending_text_hash <> md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, '')));

-- ---------------------------------------------------------------------------
-- Vocabulary suggestions
-- ---------------------------------------------------------------------------

create table public.effect_vocab_suggestions (
  id bigint generated always as identity primary key,
  kind public.effect_vocab_kind not null,
  -- For verbs: whether the tagger wanted it as an action, an event, or both.
  as_action boolean not null default false,
  as_event boolean not null default false,
  proposed_term text not null check (proposed_term ~ '^[a-z][a-z0-9_]*$'),
  description text,
  -- Example phrases from card text (deduplicated, capped by the Workflow).
  phrases text[] not null default '{}',
  example_card_ids bigint[] not null default '{}',
  occurrences integer not null default 1 check (occurrences > 0),
  -- Near-duplicates share a cluster key (set by the end-of-run clustering pass).
  cluster_key text,
  status public.effect_suggestion_status not null default 'pending',
  merged_into_verb_id smallint references public.effect_vocab_verbs (id),
  merged_into_zone_id smallint references public.effect_vocab_zones (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, proposed_term),
  check (kind = 'verb' or not (as_action or as_event)),
  check ((status = 'merged') = (merged_into_verb_id is not null or merged_into_zone_id is not null)),
  check (merged_into_verb_id is null or merged_into_zone_id is null)
);

create index effect_vocab_suggestions_status_idx on public.effect_vocab_suggestions (status);

-- ---------------------------------------------------------------------------
-- Tagging runs (Workflow bookkeeping; the import cursor is the latest completed import run per source)
-- ---------------------------------------------------------------------------

create table public.effect_tag_runs (
  id bigint generated always as identity primary key,
  kind public.effect_tag_run_kind not null,
  -- db_metadata (source, version) that triggered an import run.
  source text,
  version text,
  status public.effect_tag_run_status not null default 'running',
  workflow_instance_id text,
  model text,
  prompt_version text,
  cards_total integer not null default 0,
  cards_done integer not null default 0,
  cards_failed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((kind = 'import') = (source is not null and version is not null))
);

create index effect_tag_runs_import_cursor_idx on public.effect_tag_runs (source, started_at desc)
where kind = 'import' and status = 'completed';

-- ---------------------------------------------------------------------------
-- Gold set for tagger evals
-- ---------------------------------------------------------------------------

create table public.effect_gold_cards (
  card_id bigint primary key,
  -- Expected tagger output for the card (same shape the tagger emits).
  expected jsonb not null,
  -- Text the expectation was written against; a mismatch means the gold entry is stale.
  text_hash text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Archetype membership
-- ---------------------------------------------------------------------------

create table public.card_archetypes (
  card_id bigint not null,
  archetype text not null,
  source public.card_archetype_source not null,
  created_at timestamptz not null default now(),
  primary key (card_id, archetype, source)
);

create index card_archetypes_archetype_idx on public.card_archetypes (archetype);

-- Per-archetype override of the name-match mode (default word_start). Curated in /admin.
create table public.card_archetype_rules (
  archetype text primary key,
  match public.card_archetype_match not null,
  note text,
  updated_at timestamptz not null default now()
);

-- Case-sensitive test of whether `archetype` appears in `card_name` under `mode`.
-- A word boundary is any non letter/digit; only checked on sides where the archetype itself
-- starts/ends with a letter or digit (so "Gem-" still matches "Gem-Knight").
create function public.archetype_name_matches (card_name text, archetype text, mode public.card_archetype_match) returns boolean
language sql
immutable
set search_path = ''
as $$
  select case mode
    when 'off' then false
    when 'substring' then strpos(card_name, archetype) > 0
    else card_name ~ (
      case when archetype ~ '^[[:alnum:]]' then '(^|[^[:alnum:]])' else '' end
      || regexp_replace(archetype, '([.*+?^${}()|\[\]\\])', '\\\1', 'g')
      || case when mode = 'word' and archetype ~ '[[:alnum:]]$' then '($|[^[:alnum:]])' else '' end
    )
  end
$$;

-- Rebuilds every non-manual row from:
--   name:         the archetype string appears in the card's name per its card_archetype_rules mode
--                 (default word_start: starts at a word boundary, any suffix).
--   relations:    Konami's related-cards list (neuron_card_relations) of a card whose text quotes
--                 "<archetype>" includes this card, and this card's name contains the archetype string
--                 anywhere. Catches members word_start misses (e.g. mid-word names).
--   treat_table:  the name-based archetypes of a card this card's name is treated as (neuron_card_treat).
--   treated_text: "(This card is [also] always treated as a "X" [and "Y"] card.)" / "still treated as".
-- Any of the above is suppressed by "(This card is not treated as a "X" card.)", and archetypes whose
-- rule is 'off' get no automatic rows. Archetype names come from ygoprodeck_archetypes, plus any named
-- in treated-as text.
create function public.refresh_card_archetypes () returns integer
language plpgsql
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.card_archetypes where source <> 'manual';

  with en as (
    -- Neuron appends "(Updated from: <old name>)" to renamed cards; only the current name counts.
    select id,
      regexp_replace(name, '\s*\(Updated from: .*\)$', '') as name,
      coalesce(effect_text, '') || E'\n' || coalesce(pendulum_text, '') as txt
    from public.neuron_cards where language = 'en'
  ),
  denied as (
    select en.id, m[1] as archetype
    from en, regexp_matches(en.txt, 'not treated as an? "([^"]+)" card', 'gi') as m
  ),
  treated_text as (
    select distinct en.id, q[1] as archetype
    from en,
      regexp_matches(en.txt, '(?:always|still) treated as an? ((?:"[^"]+"(?:,? and |, )?)+) card', 'gi') as g,
      regexp_matches(g[1], '"([^"]+)"', 'g') as q
  ),
  archetypes as (
    select a.name, coalesce(r.match, 'word_start') as match
    from (select name from public.ygoprodeck_archetypes union select archetype from treated_text) a
    left join public.card_archetype_rules r on r.archetype = a.name
  ),
  by_name as (
    select en.id, a.name as archetype
    from en join archetypes a on strpos(en.name, a.name) > 0
    where public.archetype_name_matches(en.name, a.name, a.match)
  ),
  by_relations as (
    select distinct rel.relation_card_id as id, a.name as archetype
    from archetypes a
    join en ref on strpos(ref.txt, '"' || a.name || '"') > 0
    join public.neuron_card_relations rel on rel.card_id = ref.id
    join en member on member.id = rel.relation_card_id
    where a.match <> 'off' and strpos(member.name, a.name) > 0
  ),
  by_treat as (
    select distinct t.card_id as id, bn.archetype
    from public.neuron_card_treat t
    join by_name bn on bn.id = t.treated_card_id
    where exists (select 1 from en where en.id = t.card_id)
  ),
  all_rows as (
    select id, archetype, 'name'::public.card_archetype_source as source from by_name
    union all
    select id, archetype, 'relations' from by_relations
    union all
    select id, archetype, 'treat_table' from by_treat
    union all
    select id, archetype, 'treated_text' from treated_text
  )
  insert into public.card_archetypes (card_id, archetype, source)
  select r.id, r.archetype, r.source
  from all_rows r
  where not exists (select 1 from denied d where d.id = r.id and d.archetype = r.archetype)
    and not exists (select 1 from public.card_archetype_rules x where x.archetype = r.archetype and x.match = 'off')
  on conflict do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Name-only memberships Konami's relations don't back up, for an archetype that relations do confirm
-- elsewhere (e.g. "Final Fusion" for "Fusion"). Likely false positives, but relations come from the OCG
-- database, so TCG-only and brand-new cards land here too: review in /admin, don't auto-drop.
create view public.card_archetypes_unconfirmed with (security_invoker = true) as
select n.card_id, n.archetype
from public.card_archetypes n
where n.source = 'name'
  and exists (select 1 from public.card_archetypes r where r.archetype = n.archetype and r.source = 'relations')
  and not exists (
    select 1 from public.card_archetypes x
    where x.card_id = n.card_id and x.archetype = n.archetype and x.source <> 'name'
  );

-- ---------------------------------------------------------------------------
-- RLS: service role only
-- ---------------------------------------------------------------------------

alter table public.effect_vocab_verbs enable row level security;
alter table public.effect_vocab_zones enable row level security;
alter table public.effect_card_tags enable row level security;
alter table public.effect_effects enable row level security;
alter table public.effect_actions enable row level security;
alter table public.effect_triggers enable row level security;
alter table public.effect_vocab_suggestions enable row level security;
alter table public.effect_tag_runs enable row level security;
alter table public.effect_gold_cards enable row level security;
alter table public.card_archetypes enable row level security;
alter table public.card_archetype_rules enable row level security;

revoke execute on function public.refresh_card_archetypes () from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed archetype rules (only clear-cut cases; the rest is curated in /admin)
-- ---------------------------------------------------------------------------

insert into public.card_archetype_rules (archetype, match, note) values
  ('Ra', 'word', 'word_start matched hundreds of unrelated names (Axe Raider, Rabid Horseman, Rare Fish)'),
  ('hunder', 'off', 'ygoprodeck fragment, not a printed archetype name'),
  ('-Eyes Dragon', 'off', 'ygoprodeck fragment, not a printed archetype name');

-- ---------------------------------------------------------------------------
-- Seed vocabulary
-- ---------------------------------------------------------------------------

insert into public.effect_vocab_zones (term, description) values
  ('deck', 'Main Deck'),
  ('extra_deck', 'Extra Deck (face-down or face-up)'),
  ('hand', 'Hand'),
  ('field', 'Anywhere on the field, when the text does not name a more specific zone'),
  ('monster_zone', 'Main Monster Zones and Extra Monster Zones'),
  ('spell_trap_zone', 'Spell & Trap Zones'),
  ('pendulum_zone', 'Pendulum Zones'),
  ('field_zone', 'Field Zone'),
  ('gy', 'Graveyard'),
  ('banished', 'Banished (face-up or face-down)'),
  ('xyz_material', 'Attached to an Xyz Monster as material');

insert into public.effect_vocab_verbs (term, description, usable_as_action, usable_as_event) values
  ('special_summon', 'Special Summon a monster', true, true),
  ('normal_summon', 'Normal Summon (including Tribute Summon) a monster', true, true),
  ('flip_summon', 'Flip Summon a monster', true, true),
  ('set', 'Set a card face-down', true, true),
  ('tribute', 'Tribute a monster (from the zones in from_zones, e.g. hand and/or field)', true, true),
  ('add_to_hand', 'Add a card to the hand from somewhere other than drawing (search, salvage, bounce from banished, ...)', true, true),
  ('send_to_gy', 'Send a card to the GY (including mill from Deck, and discard when the text says "send")', true, true),
  ('banish', 'Banish a card', true, true),
  ('destroy', 'Destroy a card', true, true),
  ('return_to_hand', 'Return a card from the field to the hand', true, true),
  ('return_to_deck', 'Shuffle or place a card into the Deck or Extra Deck', true, true),
  ('draw', 'Draw cards', true, true),
  ('discard', 'Discard a card from the hand', true, true),
  ('reveal', 'Reveal a card (e.g. from the hand)', true, false),
  ('negate_activation', 'Negate the activation of a card or effect', true, false),
  ('negate_effect', 'Negate the effects of a card or an effect', true, false),
  ('negate_summon', 'Negate a Summon', true, false),
  ('take_control', 'Take control of a monster', true, true),
  ('attach_material', 'Attach a card to an Xyz Monster as material', true, true),
  ('detach_material', 'Detach material from an Xyz Monster', true, true),
  ('equip', 'Equip a card to a monster', true, true),
  ('place_on_field', 'Place a card on the field without Summoning or activating it (e.g. as a Continuous Spell, in a Pendulum Zone)', true, false),
  ('change_stats', 'Change ATK, DEF, Level or Rank (see stat / stat_mode / stat_amount)', true, false),
  ('change_position', 'Change a monster''s battle position', true, true),
  ('inflict_damage', 'Inflict damage to a player', true, true),
  ('gain_lp', 'A player gains Life Points', true, true),
  ('lose_lp', 'A player loses Life Points (not damage)', true, false),
  -- Event-only verbs for triggers.
  ('summoned', 'A monster is Summoned by any method', false, true),
  ('flipped', 'A monster is flipped face-up (FLIP effects)', false, true),
  ('leaves_field', 'A card leaves the field', false, true),
  ('targeted', 'A card is targeted by a card or effect', false, true),
  ('attack_declared', 'An attack is declared', false, true),
  ('battle_damage', 'Battle damage is inflicted', false, true),
  ('activated', 'A card or effect is activated', false, true);
