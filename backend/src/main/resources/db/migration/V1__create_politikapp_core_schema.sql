create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = current_timestamp;
  return new;
end;
$$;

create table if not exists public.contributors (
  contributor_id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  email varchar(150) not null unique,
  username varchar(80) unique,
  password_hash varchar(255) not null,
  role varchar(50) not null default 'CONTRIBUTOR',
  account_status varchar(50) not null default 'ACTIVE',
  trust_score numeric(5, 2) default 100.00,
  writing_token_status varchar(50) default 'ACTIVE',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  constraint contributors_role_check check (role in ('CONTRIBUTOR', 'PEER', 'ADMIN')),
  constraint contributors_account_status_check check (account_status in ('ACTIVE', 'LOCKED', 'SUSPENDED')),
  constraint contributors_writing_token_status_check check (
    writing_token_status in ('ACTIVE', 'INVALIDATED', 'EXPIRED')
  )
);

create table if not exists public.politicians (
  politician_id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  position varchar(100) not null,
  jurisdiction varchar(100) not null,
  party_affiliation varchar(100),
  term_start date not null,
  term_end date not null,
  profile_image_url text,
  biography text,
  status varchar(50) default 'ACTIVE',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  constraint politicians_status_check check (status in ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);

create table if not exists public.profile_edit_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  politician_id uuid not null references public.politicians(politician_id) on delete cascade,
  contributor_id uuid not null references public.contributors(contributor_id) on delete restrict,
  source_url text not null,
  category_tag varchar(100) not null,
  action_identifier varchar(150) not null,
  quantitative_metric numeric(10, 2) not null,
  impact_summary text not null,
  ai_generated boolean default false,
  status varchar(50) default 'SUBMITTED',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  constraint profile_edit_submissions_status_check check (
    status in ('SUBMITTED', 'REJECTED', 'JURY_REVIEW', 'PUBLISHED')
  )
);

create table if not exists public.moderation_queue (
  queue_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.profile_edit_submissions(submission_id) on delete cascade,
  politician_id uuid not null references public.politicians(politician_id) on delete cascade,
  queue_status varchar(50) default 'PENDING',
  escalation_flag boolean default false,
  assigned_at timestamp default current_timestamp,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  constraint moderation_queue_status_check check (
    queue_status in ('PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'PUBLISHED', 'REJECTED')
  )
);

create table if not exists public.timeline_entries (
  timeline_id uuid primary key default gen_random_uuid(),
  politician_id uuid not null references public.politicians(politician_id) on delete cascade,
  category_tag varchar(100) not null,
  action_identifier varchar(150) not null,
  quantitative_metric numeric(10, 2) default 0.00,
  summary text not null,
  source_url text,
  publication_status varchar(50) default 'PUBLISHED',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp,
  constraint timeline_entries_publication_status_check check (
    publication_status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')
  )
);

create table if not exists public.jury_votes (
  vote_id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.moderation_queue(queue_id) on delete cascade,
  peer_id uuid not null references public.contributors(contributor_id) on delete restrict,
  vote_type varchar(50) not null,
  vote_weight integer not null default 1,
  vote_reason text not null,
  created_at timestamp default current_timestamp,
  constraint jury_votes_vote_type_check check (vote_type in ('AGREE', 'DISAGREE', 'FLAG'))
);

create index if not exists idx_politicians_status on public.politicians(status);
create index if not exists idx_politicians_full_name on public.politicians(full_name);
create index if not exists idx_profile_edit_submissions_politician_status
  on public.profile_edit_submissions(politician_id, status);
create index if not exists idx_timeline_entries_politician_publication
  on public.timeline_entries(politician_id, publication_status, created_at desc);
create index if not exists idx_moderation_queue_status on public.moderation_queue(queue_status);
create index if not exists idx_jury_votes_queue_id on public.jury_votes(queue_id);

drop trigger if exists set_contributors_updated_at on public.contributors;
create trigger set_contributors_updated_at
before update on public.contributors
for each row execute function public.set_updated_at();

drop trigger if exists set_politicians_updated_at on public.politicians;
create trigger set_politicians_updated_at
before update on public.politicians
for each row execute function public.set_updated_at();

drop trigger if exists set_profile_edit_submissions_updated_at on public.profile_edit_submissions;
create trigger set_profile_edit_submissions_updated_at
before update on public.profile_edit_submissions
for each row execute function public.set_updated_at();

drop trigger if exists set_moderation_queue_updated_at on public.moderation_queue;
create trigger set_moderation_queue_updated_at
before update on public.moderation_queue
for each row execute function public.set_updated_at();

drop trigger if exists set_timeline_entries_updated_at on public.timeline_entries;
create trigger set_timeline_entries_updated_at
before update on public.timeline_entries
for each row execute function public.set_updated_at();
