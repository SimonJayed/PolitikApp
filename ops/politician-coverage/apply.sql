-- Executed in the runner's approved transaction after its locked preflight and backup.
do $coverage$
declare
    initial_count bigint := (select count(*) from public.politicians);
    removed_count bigint := (select count(*) from coverage_candidates);
    added_count bigint := (select count(*) from coverage_roster where profile_id is null);
    changed_count bigint;
begin
    delete from public.curation_audit_events
    where queue_id in (select queue_id from public.moderation_queue join coverage_candidates using (politician_id))
       or submission_id in (select submission_id from public.profile_edit_submissions join coverage_candidates using (politician_id));

    delete from public.moderation_queue using coverage_candidates c
    where moderation_queue.politician_id=c.politician_id;

    delete from public.profile_edit_submissions using coverage_candidates c
    where profile_edit_submissions.politician_id=c.politician_id;

    delete from public.timeline_entries using coverage_candidates c
    where timeline_entries.politician_id=c.politician_id;

    delete from public.politician_accomplishments using coverage_candidates c
    where politician_accomplishments.politician_id=c.politician_id;

    delete from public.news_politicians using coverage_candidates c
    where news_politicians.politician_id=c.politician_id;

    update public.open_congress_entities e set politician_id=null, linked_at=null
    from coverage_candidates c where e.politician_id=c.politician_id;

    delete from public.politicians using coverage_candidates c where politicians.politician_id=c.politician_id;
    get diagnostics changed_count = row_count;
    if changed_count <> removed_count then
        raise exception 'Deleted profile count changed during the operation';
    end if;

    update public.politicians p
    set position=r.position, jurisdiction='NATIONAL', status='ACTIVE',
        term_start=case when p.position=r.position then coalesce(r.term_start,p.term_start) else r.term_start end,
        term_end=case when p.position=r.position then coalesce(r.term_end,p.term_end) else r.term_end end,
        updated_at=now()
    from coverage_roster r where p.politician_id=r.profile_id;

    insert into public.politicians (politician_id, full_name, position, jurisdiction, status, term_start, term_end,
        biography, profile_origin, created_at, updated_at)
    select id, name, position, 'NATIONAL', 'ACTIVE', term_start, term_end,
        'Philippine Executive Branch official. Office verified on November 26, 2026. Official source: ' || source,
        'ADMIN_CURATED', now(), now()
    from coverage_roster where profile_id is null;
    get diagnostics changed_count = row_count;
    if changed_count <> added_count
        or (select count(*) from public.politicians) <> initial_count - removed_count + added_count
        or exists (select 1 from coverage_roster r left join public.politicians p on p.politician_id=r.id
            where p.position is distinct from r.position or p.status is distinct from 'ACTIVE')
        or exists (select 1 from public.timeline_entries join coverage_candidates using (politician_id))
        or exists (select 1 from public.profile_edit_submissions join coverage_candidates using (politician_id))
        or exists (select 1 from public.moderation_queue join coverage_candidates using (politician_id))
        or exists (select 1 from public.news_politicians join coverage_candidates using (politician_id))
        or exists (select 1 from public.politician_accomplishments join coverage_candidates using (politician_id))
        or exists (select 1 from public.open_congress_entities join coverage_candidates using (politician_id)) then
        raise exception 'Final coverage checks failed';
    end if;
end
$coverage$;
