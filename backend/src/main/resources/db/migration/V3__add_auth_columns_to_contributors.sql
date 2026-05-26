alter table if exists public.contributors
  add column if not exists username varchar(80),
  add column if not exists password_hash varchar(255);

create unique index if not exists idx_contributors_username_unique
  on public.contributors (lower(username))
  where username is not null;
