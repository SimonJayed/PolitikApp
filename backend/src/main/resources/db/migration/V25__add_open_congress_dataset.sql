-- Intentionally outside Flyway's active db/migration location until explicitly approved.
-- Move into db/migration only after reviewing and authorizing V25.
-- Imported revisions never overwrite curated politicians, timelines or news.
create table public.open_congress_entities (
    id text primary key,
    kind text not null check (kind in ('PERSON', 'CONGRESS', 'CHAMBER', 'COMMITTEE', 'BILL')),
    current_revision text,
    politician_id uuid unique references public.politicians(politician_id) on delete restrict,
    linked_at timestamptz,
    check (politician_id is null or kind = 'PERSON')
);

create table public.open_congress_revisions (
    entity_id text not null references public.open_congress_entities(id) on delete restrict,
    revision text not null,
    title text,
    congress integer,
    subtype text,
    bill_number text,
    filed_date date,
    -- Verbatim upstream statuses and history; filing does NOT imply enactment.
    payload jsonb not null,
    source_urls jsonb not null default '[]',
    uncertainty_flags jsonb not null default '[]',
    dataset_path text not null,
    dataset_commit text not null,
    upstream_blob text not null,
    snapshot_updated_at timestamptz not null,
    source_updated_at text,
    imported_at timestamptz not null default now(),
    primary key (entity_id, revision),
    check (jsonb_typeof(source_urls) = 'array'),
    check (jsonb_typeof(uncertainty_flags) = 'array')
);

alter table public.open_congress_entities add constraint open_congress_current_revision_fk
    foreign key (id, current_revision) references public.open_congress_revisions(entity_id, revision);

create table public.open_congress_relationships (
    entity_id text not null,
    revision text not null,
    relationship text not null check (relationship in ('MEMBER_OF', 'AUTHORED_BY')),
    external_key text not null,
    target_id text references public.open_congress_entities(id) on delete restrict,
    details jsonb not null,
    primary key (entity_id, revision, relationship, external_key),
    foreign key (entity_id, revision) references public.open_congress_revisions(entity_id, revision) on delete restrict
);

create index open_congress_entities_kind_idx on public.open_congress_entities(kind, id);
create index open_congress_bills_identity_idx on public.open_congress_revisions(congress, subtype, bill_number);
create index open_congress_relationships_target_idx on public.open_congress_relationships(target_id, relationship);

-- Access through authenticated Spring admin endpoints, not the public Supabase API.
alter table public.open_congress_entities enable row level security;
alter table public.open_congress_revisions enable row level security;
alter table public.open_congress_relationships enable row level security;
