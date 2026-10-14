-- Effect search (/search), phase 3: re-tag requests and orphan cleanup for the tagging Workflow.
-- Design: docs/design/effect-search.md
--
-- Approving/merging a vocabulary suggestion or retiring a term must re-tag only the affected cards, whose
-- text hasn't changed. `retag_reason` puts a tagged card back in effect_tag_queue; storing or drafting the
-- card's tags (effect_store_card_tags) clears it.

alter table public.effect_card_tags add column retag_reason text;

create index effect_card_tags_retag_idx on public.effect_card_tags (card_id) where retag_reason is not null;

-- Storing or drafting a card satisfies its re-tag request: same function as in
-- 20261013120000_effect_search_tag_storage.sql, plus clearing retag_reason in both write paths.
create or replace function public.effect_store_card_tags (
  p_card_id bigint,
  p_output jsonb,
  p_rows jsonb,
  p_model text,
  p_prompt_version text,
  p_mode text,
  p_text_hash text default null
) returns text
language plpgsql
set search_path = ''
as $$
declare
  is_locked boolean;
  v_hash text;
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

  v_hash := coalesce(p_text_hash, (
    select md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, ''))
    from public.neuron_cards c where c.id = p_card_id and c.language = 'en'
  ));
  if v_hash is null then
    raise exception 'no English card %', p_card_id;
  end if;

  select locked into is_locked from public.effect_card_tags where card_id = p_card_id for update;

  if p_mode = 'tagger' and coalesce(is_locked, false) then
    update public.effect_card_tags
    set pending_draft = p_output, pending_text_hash = v_hash, model = p_model, prompt_version = p_prompt_version, retag_reason = null
    where card_id = p_card_id;
    return 'drafted';
  end if;

  insert into public.effect_card_tags as t (card_id, text_hash, output, source, locked, model, prompt_version, tagged_at)
  values (p_card_id, v_hash, p_output, p_mode, p_mode = 'manual', p_model, p_prompt_version, now())
  on conflict (card_id) do update
  set text_hash = excluded.text_hash,
    output = excluded.output,
    source = excluded.source,
    locked = excluded.locked,
    pending_draft = null,
    retag_reason = null,
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

-- Same as before, plus cards with an open re-tag request (locked ones get a draft, as for errata).
create or replace view public.effect_tag_queue with (security_invoker = true) as
select
  c.id as card_id,
  md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, '')) as text_hash,
  t.card_id is null as never_tagged,
  coalesce(t.locked, false) as locked,
  t.retag_reason
from public.neuron_cards c
left join public.effect_card_tags t on t.card_id = c.id
where c.language = 'en'
  and (
    t.card_id is null
    or t.retag_reason is not null
    or (
      t.text_hash <> md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, ''))
      and (t.pending_text_hash is null or t.pending_text_hash <> md5(coalesce(c.effect_text, '') || E'\x1f' || coalesce(c.pendulum_text, '')))
    )
  );

-- Marks tagged cards for re-tagging; returns how many were marked.
create function public.effect_request_retag (p_card_ids bigint[], p_reason text) returns integer
language sql
set search_path = ''
as $$
  with marked as (
    update public.effect_card_tags set retag_reason = p_reason where card_id = any (p_card_ids) returning 1
  )
  select count(*)::integer from marked;
$$;

-- Removes tags for cards that no longer exist in English (the importer owns neuron_cards, so there is no FK).
create function public.effect_delete_orphan_tags () returns integer
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.effect_card_tags t
    where not exists (select 1 from public.neuron_cards c where c.id = t.card_id and c.language = 'en')
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function public.effect_request_retag (bigint[], text) from public, anon, authenticated;
revoke execute on function public.effect_delete_orphan_tags () from public, anon, authenticated;

-- How many stored actions/triggers use each vocabulary term (for /admin vocabulary management).
create view public.effect_vocab_usage with (security_invoker = true) as
select 'verb'::public.effect_vocab_kind as kind, v.id, v.term,
  (select count(*) from public.effect_actions a where a.verb_id = v.id)::integer as actions,
  (select count(*) from public.effect_triggers t where t.event_verb_id = v.id)::integer as triggers
from public.effect_vocab_verbs v
union all
select 'zone'::public.effect_vocab_kind, z.id, z.term,
  (select count(*) from public.effect_actions a where z.id = any (a.from_zones) or z.id = any (a.to_zones))::integer,
  (select count(*) from public.effect_triggers t where z.id = any (t.from_zones))::integer
from public.effect_vocab_zones z;
