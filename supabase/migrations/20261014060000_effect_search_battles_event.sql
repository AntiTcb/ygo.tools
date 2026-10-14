-- Effect search: "battles" event ("When this card battles a monster", "at the start of the Damage
-- Step, if this card battles"), which battle_damage was standing in for. Idempotent.

insert into public.effect_vocab_verbs (term, description, usable_as_action, usable_as_event)
values ('battles', 'A monster battles (is involved in a battle), whether or not battle damage is inflicted', false, true)
on conflict (term) do nothing;
