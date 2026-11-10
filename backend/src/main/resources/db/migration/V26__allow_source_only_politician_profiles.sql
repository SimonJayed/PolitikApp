-- Additive change: retain every existing value and permit source-only profiles.
alter table public.politicians alter column position drop not null;
alter table public.politicians alter column jurisdiction drop not null;
alter table public.politicians alter column term_start drop not null;
alter table public.politicians alter column term_end drop not null;
alter table public.politicians add column profile_origin varchar(40) not null default 'ADMIN_CURATED';
alter table public.politicians add constraint politicians_profile_origin_check
    check (profile_origin in ('ADMIN_CURATED', 'CONGRESS_DATASET'));
create index open_congress_revision_import_idx on public.open_congress_revisions(entity_id, imported_at desc);

create table public.open_congress_population_runs (
    id uuid primary key,
    dataset_commit text not null,
    completed_at timestamptz not null default now(),
    report jsonb not null
);
alter table public.open_congress_population_runs enable row level security;
