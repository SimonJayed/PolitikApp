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
  updated_at timestamptz not null default now(),
  constraint government_sources_name_unique unique (name),
  constraint government_sources_retrieval_type_check check (retrieval_type in ('RSS', 'API', 'HTML'))
);

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
  updated_at timestamptz not null default now(),
  constraint news_articles_status_check check (status in ('RETRIEVED', 'PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED', 'UNPUBLISHED')),
  constraint news_articles_canonical_unique unique (canonical_url)
);

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
  updated_at timestamptz not null default now(),
  constraint comment_votes_vote_type_check check (vote_type in ('UP', 'DOWN')),
  constraint comment_votes_one_vote_per_user unique (comment_id, user_id)
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

create index if not exists idx_news_articles_status_published_at on public.news_articles(status, published_at desc);
create index if not exists idx_news_articles_category on public.news_articles(category);
create index if not exists idx_news_comments_news_created_at on public.news_comments(news_id, created_at desc);
create index if not exists idx_comment_votes_comment on public.comment_votes(comment_id);

create trigger trg_government_sources_updated_at
before update on public.government_sources
for each row execute function public.set_updated_at();

create trigger trg_news_articles_updated_at
before update on public.news_articles
for each row execute function public.set_updated_at();

create trigger trg_news_comments_updated_at
before update on public.news_comments
for each row execute function public.set_updated_at();

insert into public.government_sources (name, base_url, feed_url, retrieval_type)
values ('Official Gazette of the Republic of the Philippines', 'https://www.officialgazette.gov.ph', 'https://www.officialgazette.gov.ph/feed/', 'RSS')
on conflict (name) do nothing;
