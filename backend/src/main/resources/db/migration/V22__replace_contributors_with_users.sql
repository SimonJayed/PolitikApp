create extension if not exists pgcrypto;

create table if not exists users (
  user_id uuid primary key default gen_random_uuid(),
  full_name varchar(150) not null,
  email varchar(150) not null,
  username varchar(80),
  password_hash varchar(255) not null,
  role varchar(50) not null default 'CONTRIBUTOR',
  account_status varchar(50) not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users
  add column if not exists user_id uuid,
  add column if not exists full_name varchar(150),
  add column if not exists email varchar(150),
  add column if not exists username varchar(80),
  add column if not exists password_hash varchar(255),
  add column if not exists role varchar(50) not null default 'CONTRIBUTOR',
  add column if not exists account_status varchar(50) not null default 'ACTIVE',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'users'
      and column_name = 'id'
  ) then
    execute 'update users set user_id = id where user_id is null';
  end if;
end $$;

update users set user_id = gen_random_uuid() where user_id is null;
alter table users alter column user_id set default gen_random_uuid();
alter table users alter column user_id set not null;

update users set full_name = coalesce(nullif(full_name, ''), username, email, 'User') where full_name is null;
update users set email = user_id::text || '@local.politikapp' where email is null;
update users set role = 'CONTRIBUTOR' where role is null;
update users set account_status = 'ACTIVE' where account_status is null;

alter table users alter column full_name set not null;
alter table users alter column email set not null;
alter table users alter column role set not null;
alter table users alter column account_status set not null;

create unique index if not exists idx_users_user_id_unique on users(user_id);
create unique index if not exists idx_users_email_unique on users(lower(email));
create unique index if not exists idx_users_username_unique
  on users(lower(username))
  where username is not null;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('CONTRIBUTOR', 'PEER', 'ADMIN', 'ADMINISTRATOR'));

alter table users drop constraint if exists users_account_status_check;
alter table users add constraint users_account_status_check
  check (account_status in ('ACTIVE', 'LOCKED', 'SUSPENDED'));

drop trigger if exists set_users_updated_at on users;
create trigger set_users_updated_at
before update on users
for each row execute function set_updated_at();

do $$
declare
  constraint_record record;
begin
  if to_regclass('contributors') is not null then
    for constraint_record in
      select conrelid::regclass as table_name, conname
      from pg_constraint
      where confrelid = 'contributors'::regclass
    loop
      execute format(
        'alter table %s drop constraint if exists %I',
        constraint_record.table_name,
        constraint_record.conname
      );
    end loop;
  end if;
end $$;

do $$
begin
  if to_regclass('profile_edit_submissions') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_profile_edit_submissions_contributor_user') then
    alter table profile_edit_submissions
      add constraint fk_profile_edit_submissions_contributor_user
      foreign key (contributor_id) references users(user_id) on delete restrict not valid;
  end if;

  if to_regclass('jury_votes') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_jury_votes_peer_user') then
    alter table jury_votes
      add constraint fk_jury_votes_peer_user
      foreign key (peer_id) references users(user_id) on delete restrict not valid;
  end if;

  if to_regclass('peer_applications') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_peer_applications_contributor_user') then
    alter table peer_applications
      add constraint fk_peer_applications_contributor_user
      foreign key (contributor_id) references users(user_id) on delete cascade not valid;
  end if;

  if to_regclass('reputation_logs') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_reputation_logs_peer_user') then
    alter table reputation_logs
      add constraint fk_reputation_logs_peer_user
      foreign key (peer_id) references users(user_id) on delete restrict not valid;
  end if;

  if to_regclass('news_articles') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_news_articles_reviewed_by_user') then
    alter table news_articles
      add constraint fk_news_articles_reviewed_by_user
      foreign key (reviewed_by) references users(user_id) on delete set null not valid;
  end if;

  if to_regclass('news_comments') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_news_comments_user') then
    alter table news_comments
      add constraint fk_news_comments_user
      foreign key (user_id) references users(user_id) on delete restrict not valid;
  end if;

  if to_regclass('comment_votes') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_comment_votes_user') then
    alter table comment_votes
      add constraint fk_comment_votes_user
      foreign key (user_id) references users(user_id) on delete cascade not valid;
  end if;

  if to_regclass('saved_posts') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_saved_posts_user') then
    alter table saved_posts
      add constraint fk_saved_posts_user
      foreign key (user_id) references users(user_id) on delete cascade not valid;
  end if;

  if to_regclass('news_audit_logs') is not null
      and not exists (select 1 from pg_constraint where conname = 'fk_news_audit_logs_admin_user') then
    alter table news_audit_logs
      add constraint fk_news_audit_logs_admin_user
      foreign key (admin_id) references users(user_id) on delete set null not valid;
  end if;
end $$;

drop trigger if exists set_contributors_updated_at on contributors;
drop table if exists contributors cascade;
