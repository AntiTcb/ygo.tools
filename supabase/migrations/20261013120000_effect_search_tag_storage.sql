-- Effect search (/search), phase 2: storing tagger output.
-- Design: docs/design/effect-search.md
--
-- Each card keeps the full tagger output (`effect_card_tags.output`, the editable source of truth in
-- /admin) plus a queryable projection in effect_effects / effect_actions / effect_triggers. Targets are
-- stored both as the tagger's readable target (`target`, see src/lib/effect-search/tagSchema.ts) and
-- compiled to a RuleNode (`target_rule`) for search.

alter table public.effect_card_tags
  add column output jsonb,
  -- Who wrote the live tags: the tagger, or a hand correction in /admin.
  add column source text not null default 'tagger' check (source in ('tagger', 'manual'));

alter table public.effect_actions
  add column target_rule jsonb,
  -- Quoted names the tagger reported that matched no English card.
  add column unresolved_name_refs text[] not null default '{}';

comment on column public.effect_actions.target is 'Tagger target (tagSchema.ts Target); compiled form in target_rule';

alter table public.effect_triggers
  add column subject_rule jsonb,
  add column cause_card_rule jsonb;

comment on column public.effect_triggers.subject is 'Tagger target (tagSchema.ts Target); compiled form in subject_rule';
comment on column public.effect_triggers.cause_card is 'Tagger target (tagSchema.ts Target); compiled form in cause_card_rule';

-- Replaces a card's tags in one transaction.
--   p_output: the tagger output (TagOutput), kept verbatim.
--   p_rows:   its projection, built by src/lib/effect-search/store.ts:
--             [{text_source, effect_index, effect_type, opt, phase_restriction[], turn_restriction, snippet,
--               actions: [{verb, from_zones[], to_zones[], from_side, to_side, is_cost, is_self, quantity,
--                          target, target_rule, name_refs[], unresolved_name_refs[], contextual, context_note,
--                          stat, stat_mode, stat_amount, stat_amount_note}],
--               triggers: [{event, subject_is_self, subject, subject_rule, from_zones[], subject_side, cause,
--                           cause_side, cause_card, cause_card_rule}]}]
--   p_mode:   'tagger' — a locked card keeps its live tags and gets the output as a pending draft;
--             'manual' — hand correction: replaces the tags, locks the card, clears any draft.
-- Returns 'stored' or 'drafted'. Unknown verbs/zones raise (nothing is written).
create function public.effect_store_card_tags (
  p_card_id bigint,
  p_text_hash text,
  p_output jsonb,
  p_rows jsonb,
  p_model text,
  p_prompt_version text,
  p_mode text
) returns text
language plpgsql
set search_path = ''
as $$
declare
  is_locked boolean;
  eff jsonb;
  act jsonb;
  trg jsonb;
  new_effect_id bigint;
  seq_no smallint;
  verb smallint;
begin
  if p_mode not in ('tagger', 'manual') then
    raise exception 'unknown mode %', p_mode;
  end if;

  select locked into is_locked from public.effect_card_tags where card_id = p_card_id for update;

  if p_mode = 'tagger' and coalesce(is_locked, false) then
    update public.effect_card_tags
    set pending_draft = p_output, pending_text_hash = p_text_hash, model = p_model, prompt_version = p_prompt_version
    where card_id = p_card_id;
    return 'drafted';
  end if;

  insert into public.effect_card_tags as t (card_id, text_hash, output, source, locked, model, prompt_version, tagged_at)
  values (p_card_id, p_text_hash, p_output, p_mode, p_mode = 'manual', p_model, p_prompt_version, now())
  on conflict (card_id) do update
  set text_hash = excluded.text_hash,
    output = excluded.output,
    source = excluded.source,
    locked = excluded.locked,
    pending_draft = null,
    pending_text_hash = null,
    model = excluded.model,
    prompt_version = excluded.prompt_version,
    tagged_at = excluded.tagged_at;

  delete from public.effect_effects where card_id = p_card_id;

  for eff in select * from jsonb_array_elements(p_rows) loop
    insert into public.effect_effects (card_id, text_source, effect_index, effect_type, opt, phase_restriction, turn_restriction, snippet)
    values (
      p_card_id,
      (eff ->> 'text_source')::public.effect_text_source,
      (eff ->> 'effect_index')::smallint,
      (eff ->> 'effect_type')::public.effect_type,
      (eff ->> 'opt')::public.effect_opt,
      array(select jsonb_array_elements_text(eff -> 'phase_restriction'))::public.effect_phase[],
      (eff ->> 'turn_restriction')::public.effect_turn,
      eff ->> 'snippet'
    )
    returning id into new_effect_id;

    seq_no := 0;
    for act in select * from jsonb_array_elements(eff -> 'actions') loop
      verb := null;
      select id into verb from public.effect_vocab_verbs where term = act ->> 'verb' and retired_at is null;
      if verb is null then
        raise exception 'unknown action verb %', act ->> 'verb';
      end if;
      insert into public.effect_actions (
        effect_id, card_id, seq, verb_id, from_zones, to_zones, from_side, to_side, is_cost, is_self, quantity,
        target, target_rule, name_refs, unresolved_name_refs, contextual, context_note, stat, stat_mode, stat_amount, stat_amount_note
      ) values (
        new_effect_id, p_card_id, seq_no, verb,
        public.effect_zone_ids(act -> 'from_zones'),
        public.effect_zone_ids(act -> 'to_zones'),
        (act ->> 'from_side')::public.effect_side,
        (act ->> 'to_side')::public.effect_side,
        (act ->> 'is_cost')::boolean,
        (act ->> 'is_self')::boolean,
        (act ->> 'quantity')::smallint,
        nullif(act -> 'target', 'null'::jsonb),
        nullif(act -> 'target_rule', 'null'::jsonb),
        array(select (jsonb_array_elements_text(act -> 'name_refs'))::bigint),
        array(select jsonb_array_elements_text(act -> 'unresolved_name_refs')),
        (act ->> 'contextual')::boolean,
        act ->> 'context_note',
        (act ->> 'stat')::public.effect_stat,
        (act ->> 'stat_mode')::public.effect_stat_mode,
        (act ->> 'stat_amount')::integer,
        act ->> 'stat_amount_note'
      );
      seq_no := seq_no + 1;
    end loop;

    for trg in select * from jsonb_array_elements(eff -> 'triggers') loop
      verb := null;
      select id into verb from public.effect_vocab_verbs where term = trg ->> 'event' and retired_at is null;
      if verb is null then
        raise exception 'unknown event verb %', trg ->> 'event';
      end if;
      insert into public.effect_triggers (
        effect_id, card_id, event_verb_id, subject_is_self, subject, subject_rule, from_zones, subject_side,
        cause, cause_side, cause_card, cause_card_rule
      ) values (
        new_effect_id, p_card_id, verb,
        (trg ->> 'subject_is_self')::boolean,
        nullif(trg -> 'subject', 'null'::jsonb),
        nullif(trg -> 'subject_rule', 'null'::jsonb),
        public.effect_zone_ids(trg -> 'from_zones'),
        (trg ->> 'subject_side')::public.effect_side,
        (trg ->> 'cause')::public.effect_trigger_cause,
        (trg ->> 'cause_side')::public.effect_side,
        nullif(trg -> 'cause_card', 'null'::jsonb),
        nullif(trg -> 'cause_card_rule', 'null'::jsonb)
      );
    end loop;
  end loop;

  return 'stored';
end;
$$;

-- Zone terms (jsonb array of strings) -> zone ids; raises on an unknown or retired term.
create function public.effect_zone_ids (terms jsonb) returns smallint[]
language plpgsql
stable
set search_path = ''
as $$
declare
  out_ids smallint[] := '{}';
  zone_term text;
  zone smallint;
begin
  for zone_term in select jsonb_array_elements_text(coalesce(terms, '[]'::jsonb)) loop
    zone := null;
    select id into zone from public.effect_vocab_zones v where v.term = zone_term and v.retired_at is null;
    if zone is null then
      raise exception 'unknown zone %', zone_term;
    end if;
    out_ids := out_ids || zone;
  end loop;
  return out_ids;
end;
$$;

-- Records the tagger's proposed vocabulary terms for one card.
--   p_items: [{kind, as_action, as_event, proposed_term, description, phrase}]
-- Upserts on (kind, proposed_term): bumps occurrences once per card, keeps up to 10 distinct phrases and
-- 20 example cards. Rejected/merged suggestions still count occurrences (for review) but keep their status.
create function public.effect_record_suggestions (p_card_id bigint, p_items jsonb) returns void
language sql
set search_path = ''
as $$
  insert into public.effect_vocab_suggestions as s (kind, as_action, as_event, proposed_term, description, phrases, example_card_ids)
  select distinct on (i ->> 'kind', i ->> 'proposed_term')
    (i ->> 'kind')::public.effect_vocab_kind,
    coalesce((i ->> 'as_action')::boolean, false),
    coalesce((i ->> 'as_event')::boolean, false),
    i ->> 'proposed_term',
    i ->> 'description',
    array[i ->> 'phrase'],
    array[p_card_id]
  from jsonb_array_elements(p_items) as i
  on conflict (kind, proposed_term) do update
  set as_action = s.as_action or excluded.as_action,
    as_event = s.as_event or excluded.as_event,
    description = coalesce(s.description, excluded.description),
    phrases = case
      when excluded.phrases[1] = any (s.phrases) or cardinality(s.phrases) >= 10 then s.phrases
      else s.phrases || excluded.phrases
    end,
    example_card_ids = case
      when p_card_id = any (s.example_card_ids) or cardinality(s.example_card_ids) >= 20 then s.example_card_ids
      else s.example_card_ids || p_card_id
    end,
    occurrences = s.occurrences + case when p_card_id = any (s.example_card_ids) then 0 else 1 end,
    updated_at = now();
$$;

revoke execute on function public.effect_store_card_tags (bigint, text, jsonb, jsonb, text, text, text) from public, anon, authenticated;
revoke execute on function public.effect_record_suggestions (bigint, jsonb) from public, anon, authenticated;
