create table public.citation_reviews (
    record_type varchar(24) not null check (record_type in ('PROFILE','TIMELINE','SUBMISSION','ACCOMPLISHMENT')),
    record_id uuid not null,
    verification_status varchar(24) not null check (verification_status in ('VERIFIED','PENDING_VERIFICATION','UNVERIFIED','INVALID_SOURCE')),
    source_organization varchar(200),
    source_url varchar(2048),
    verification_notes varchar(5000),
    attribution varchar(24) check (attribution in ('DIRECT','ASSOCIATED_AGENCY','UNCONFIRMED')),
    record_updated_at timestamptz not null,
    reviewed_at timestamptz not null,
    reviewed_by uuid not null,
    primary key (record_type, record_id),
    check (verification_status <> 'VERIFIED' or (
        nullif(trim(source_organization), '') is not null and nullif(trim(source_url), '') is not null
        and nullif(trim(verification_notes), '') is not null
    ))
);
alter table public.citation_reviews enable row level security;
