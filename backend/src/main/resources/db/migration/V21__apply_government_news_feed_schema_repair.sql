-- ============================================================================
-- Flyway migration: V21__apply_government_news_feed_schema_repair.sql
-- Align Supabase databases that received an earlier V19 news migration with
-- the current government news feed entity model.
-- ============================================================================

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
  password_hash varchar(255),
  role varchar(50) not null default 'CONTRIBUTOR',
  account_status varchar(50) not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contributors
  add column if not exists username varchar(80),
  add column if not exists password_hash varchar(255),
  add column if not exists role varchar(50) not null default 'CONTRIBUTOR',
  add column if not exists account_status varchar(50) not null default 'ACTIVE',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_edit_submissions (
  submission_id uuid primary key default gen_random_uuid(),
  politician_id uuid not null,
  contributor_id uuid not null,
  source_url text not null,
  verification_notes text,
  category_tag varchar(100) not null,
  action_identifier varchar(150) not null,
  action_details jsonb,
  impact_summary text not null,
  ai_generated boolean,
  status varchar(50),
  challenge_target_id uuid,
  challenge_reason text,
  evidence_url text,
  admin_resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_queue (
  queue_id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  politician_id uuid not null,
  queue_status varchar(50),
  challenge_target_id uuid,
  challenge_reason text,
  evidence_url text,
  admin_resolution_notes text,
  resolved_at timestamptz,
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeline_entries (
  timeline_id uuid primary key default gen_random_uuid(),
  politician_id uuid not null,
  submission_id uuid,
  category_tag varchar(100) not null,
  action_identifier varchar(150) not null,
  action_details jsonb,
  summary text not null,
  source_url text,
  verification_notes text,
  publication_status varchar(50),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.government_sources (
  id uuid primary key default gen_random_uuid(),
  name varchar(180) not null,
  base_url text not null,
  feed_url text,
  retrieval_type varchar(40) not null default 'RSS',
  is_active boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.government_sources
  add column if not exists feed_url text,
  add column if not exists retrieval_type varchar(40) not null default 'RSS',
  add column if not exists is_active boolean not null default true,
  add column if not exists last_fetched_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.government_sources(id) on delete restrict,
  original_title text not null,
  suggested_title text,
  source_url text not null,
  canonical_url text not null,
  original_content text,
  ai_summary text,
  ai_key_points text,
  category varchar(80) not null default 'Government Announcements',
  original_published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  status varchar(40) not null default 'RETRIEVED',
  ai_model varchar(120),
  ai_processing_status varchar(40),
  ai_processed_at timestamptz,
  ai_processing_ms bigint,
  review_notes text,
  reviewed_by uuid references public.contributors(contributor_id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news_articles
  add column if not exists suggested_title text,
  add column if not exists canonical_url text,
  add column if not exists original_content text,
  add column if not exists ai_summary text,
  add column if not exists ai_key_points text,
  add column if not exists category varchar(80) not null default 'Government Announcements',
  add column if not exists original_published_at timestamptz,
  add column if not exists retrieved_at timestamptz not null default now(),
  add column if not exists status varchar(40) not null default 'RETRIEVED',
  add column if not exists ai_model varchar(120),
  add column if not exists ai_processing_status varchar(40),
  add column if not exists ai_processed_at timestamptz,
  add column if not exists ai_processing_ms bigint,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.contributors(contributor_id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.news_articles
set canonical_url = source_url
where canonical_url is null and source_url is not null;

alter table public.news_articles
  alter column canonical_url set not null;

create table if not exists public.news_politicians (
  news_id uuid not null references public.news_articles(id) on delete cascade,
  politician_id uuid not null references public.politicians(politician_id) on delete cascade,
  primary key (news_id, politician_id)
);

create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_articles(id) on delete cascade,
  user_id uuid not null references public.contributors(contributor_id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_hidden boolean not null default false,
  deleted_at timestamptz
);

create table if not exists public.comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.news_comments(id) on delete cascade,
  user_id uuid not null references public.contributors(contributor_id) on delete cascade,
  vote_type varchar(10) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.contributors(contributor_id) on delete cascade,
  news_id uuid not null references public.news_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

create table if not exists public.news_audit_logs (
  id uuid primary key default gen_random_uuid(),
  news_id uuid references public.news_articles(id) on delete cascade,
  admin_id uuid references public.contributors(contributor_id) on delete set null,
  action varchar(80) not null,
  timestamp timestamptz not null default now(),
  change_details text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'government_sources_name_unique') then
    alter table public.government_sources add constraint government_sources_name_unique unique (name);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'government_sources_retrieval_type_check') then
    alter table public.government_sources add constraint government_sources_retrieval_type_check check (retrieval_type in ('RSS', 'API', 'HTML'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'news_articles_canonical_unique') then
    alter table public.news_articles add constraint news_articles_canonical_unique unique (canonical_url);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'news_articles_status_check') then
    alter table public.news_articles add constraint news_articles_status_check check (status in ('RETRIEVED', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED', 'UNPUBLISHED'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comment_votes_vote_type_check') then
    alter table public.comment_votes add constraint comment_votes_vote_type_check check (vote_type in ('UP', 'DOWN'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comment_votes_one_vote_per_user') then
    alter table public.comment_votes add constraint comment_votes_one_vote_per_user unique (comment_id, user_id);
  end if;
end;
$$;

create index if not exists idx_news_articles_status_published_at on public.news_articles(status, published_at desc);
create index if not exists idx_news_articles_category on public.news_articles(category);
create index if not exists idx_news_comments_news_created_at on public.news_comments(news_id, created_at desc);
create index if not exists idx_comment_votes_comment on public.comment_votes(comment_id);

drop trigger if exists trg_government_sources_updated_at on public.government_sources;
create trigger trg_government_sources_updated_at
before update on public.government_sources
for each row execute function public.set_updated_at();

drop trigger if exists trg_news_articles_updated_at on public.news_articles;
create trigger trg_news_articles_updated_at
before update on public.news_articles
for each row execute function public.set_updated_at();

drop trigger if exists trg_news_comments_updated_at on public.news_comments;
create trigger trg_news_comments_updated_at
before update on public.news_comments
for each row execute function public.set_updated_at();

insert into public.government_sources (name, base_url, feed_url, retrieval_type)
values ('Official Gazette of the Republic of the Philippines', 'https://www.officialgazette.gov.ph', 'https://www.officialgazette.gov.ph/feed/', 'RSS')
on conflict (name) do nothing;
