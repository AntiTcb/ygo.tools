-- Effect search: faster refresh_card_archetypes().
--
-- Through PostgREST (as the tagging Workflow calls it) the rebuild hit the 8s statement timeout: the
-- relations source scanned every card's text for every archetype name (~8.7M substring searches).
-- It now extracts each card's quoted strings once and joins archetype names against them. Same
-- results; otherwise identical to 20261012190000_effect_search_schema.sql.

create or replace function public.refresh_card_archetypes () returns integer
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
  -- Every quoted string in every card's text, extracted once: joining archetype names against these
  -- is a hash join instead of a substring scan of every text for every archetype.
  quoted as (
    select distinct en.id, q[1] as quoted
    from en, regexp_matches(en.txt, '"([^"]+)"', 'g') as q
  ),
  by_relations as (
    select distinct rel.relation_card_id as id, a.name as archetype
    from archetypes a
    join quoted ref on ref.quoted = a.name
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
