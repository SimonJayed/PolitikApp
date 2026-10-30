-- Preserve generated evidence separately from editable administrator notes.
alter table public.news_articles add column if not exists extraction_data text;
