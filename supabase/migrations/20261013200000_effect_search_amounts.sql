-- Effect search: allow amounts on LP/damage actions ("Inflict 800 damage", "Pay half your LP").
-- stat_amount / stat_amount_note previously required a stat (change_stats only). A check constraint
-- can't see the verb's term, so which verbs may carry an amount is validated in
-- src/lib/effect-search/tagSchema.ts (validateTagOutput) instead.

alter table public.effect_actions drop constraint effect_actions_check2;

comment on column public.effect_actions.stat_amount is 'Fixed amount: the stat change for change_stats, or LP/damage for inflict_damage, gain_lp, lose_lp';
comment on column public.effect_actions.stat_amount_note is 'Amount formula when not fixed (e.g. "half your LP", "800 for each face-up monster you control")';
