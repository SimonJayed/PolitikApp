create table public.legislative_accountability (
    record_id uuid primary key,
    politician_id uuid not null references public.politicians(politician_id) on delete restrict,
    congress integer not null check (congress between 8 and 200),
    chamber varchar(6) not null check (chamber in ('SENATE','HOUSE')),
    kind varchar(10) not null check (kind in ('ATTENDANCE','VOTE','COMMITTEE')),
    decision varchar(12) not null,
    title varchar(300),
    reference varchar(150),
    event_date date,
    end_date date,
    record_key varchar(500) not null,
    source_url varchar(2048),
    verification_status varchar(24) not null check (verification_status in
        ('VERIFIED','PENDING_VERIFICATION','UNVERIFIED','INVALID_SOURCE')),
    verification_notes varchar(5000),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    withdrawn_at timestamp with time zone,
    updated_at timestamp with time zone not null default current_timestamp,
    revision bigint not null default 0,
    unique (politician_id, congress, chamber, kind, record_key),
    check (
        (kind = 'ATTENDANCE' and decision in ('PRESENT','ABSENT','EXCUSED','UNAVAILABLE')
            and event_date is not null and reference is not null and title is null and end_date is null)
        or (kind = 'VOTE' and decision in ('YES','NO','ABSTAINED','ABSENT','UNKNOWN')
            and event_date is not null and reference is not null and title is not null and end_date is null)
        or (kind = 'COMMITTEE' and decision in ('CHAIR','VICE_CHAIR','MEMBER')
            and title is not null and reference is null)
    ),
    check (end_date is null or event_date is null or end_date >= event_date),
    check (verification_status <> 'VERIFIED' or (
        nullif(trim(source_url), '') is not null and nullif(trim(verification_notes), '') is not null
        and reviewed_at is not null and reviewed_by is not null
    ))
);

create index legislative_accountability_profile_idx
    on public.legislative_accountability(politician_id, kind, congress, chamber, event_date, record_id);

-- PostgreSQL access control
alter table public.legislative_accountability enable row level security;
revoke all on public.legislative_accountability from public;

do $$
declare
    api_role text;
begin
    for api_role in select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
    loop
        execute format('revoke all on public.legislative_accountability from %I', api_role);
    end loop;
end $$;
