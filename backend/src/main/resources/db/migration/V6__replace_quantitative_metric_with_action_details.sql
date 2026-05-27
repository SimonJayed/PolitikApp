alter table public.profile_edit_submissions
  add column if not exists action_details jsonb not null default '{}'::jsonb;

alter table public.timeline_entries
  add column if not exists action_details jsonb not null default '{}'::jsonb;

update public.profile_edit_submissions
set action_details = case
  when action_identifier = 'BUDGET_ALLOCATION' then jsonb_build_object('allocationAmount', quantitative_metric)
  when action_identifier = 'COA_FINDING' then jsonb_build_object('flaggedAmount', quantitative_metric)
  else jsonb_build_object('metric', quantitative_metric)
end
where quantitative_metric is not null
  and action_details = '{}'::jsonb;

update public.timeline_entries
set action_details = case
  when action_identifier = 'BUDGET_ALLOCATION' then jsonb_build_object('allocationAmount', quantitative_metric)
  when action_identifier = 'COA_FINDING' then jsonb_build_object('flaggedAmount', quantitative_metric)
  else jsonb_build_object('metric', quantitative_metric)
end
where quantitative_metric is not null
  and action_details = '{}'::jsonb;

alter table public.profile_edit_submissions
  drop column if exists quantitative_metric;

alter table public.timeline_entries
  drop column if exists quantitative_metric;

create index if not exists idx_submissions_action_details_jsonb
  on public.profile_edit_submissions using gin (action_details);

create index if not exists idx_timeline_entries_action_details_jsonb
  on public.timeline_entries using gin (action_details);
