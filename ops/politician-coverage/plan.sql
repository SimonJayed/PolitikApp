with
scope as (
    select coalesce(current_setting('politikapp.congress_only', true) = 'on', false) as congress_only,
        coalesce(current_setting('politikapp.mayors_only', true) = 'on', false) as mayors_only
),
roster as (
    select r.*, coalesce(profile_id, md5('politikapp:executive:' || name)::uuid) as id
    from jsonb_to_recordset(cast(? as jsonb)) as r(
        name text, position text, source text, profile_id uuid, term_start date, term_end date)
),
historical_executives as (
    select * from jsonb_to_recordset(cast(? as jsonb)) as h(profile_id uuid, name text, office text, source text)
),
profiles as (
    select p.*, e.id as person_id, h.congresses,
        coalesce(h.older_only, false) as older_only,
        coalesce(h.recent, false) as recent,
        (r.id is not null or past.profile_id is not null or upper(coalesce(p.position, '')) ~
            '^(EXECUTIVE_|.*SECRETARY|PRESIDENT$|VICE PRESIDENT$|VICE_PRESIDENT$|GOVERNOR$|VICE_GOVERNOR$|MAYOR$|VICE_MAYOR$)'
            or upper(coalesce(p.position_category, '')) = 'EXECUTIVE') as executive
    from public.politicians p
    left join public.open_congress_entities e on e.politician_id=p.politician_id and e.kind='PERSON'
    left join roster r on r.id=p.politician_id
    left join historical_executives past on past.profile_id=p.politician_id
    left join lateral (
        select array_agg(distinct rel.details->>'congress' order by rel.details->>'congress') as congresses,
            bool_and(coalesce(rel.details->>'congress' ~ '^([1-9]|1[0-4])$', false))
                and bool_or(rel.revision=e.current_revision) as older_only,
            bool_or(case when rel.details->>'congress' ~ '^[0-9]{1,3}$'
                then (rel.details->>'congress')::int >= 15 else false end) as recent
        from public.open_congress_relationships rel
        where rel.entity_id=e.id and rel.relationship='MEMBER_OF'
    ) h on true
),
candidates as (
    select profiles.* from profiles cross join scope
    where case
        when scope.congress_only then not recent
        when scope.mayors_only then upper(regexp_replace(trim(coalesce(position, '')), '[^[:alnum:]]+', '_', 'g')) in
            ('MAYOR', 'VICE_MAYOR', 'CITY_MAYOR', 'CITY_VICE_MAYOR', 'MUNICIPAL_MAYOR',
             'MUNICIPAL_VICE_MAYOR', 'VICE_CITY_MAYOR', 'VICE_MUNICIPAL_MAYOR')
        else older_only and not executive end
),
submissions as (
    select s.* from public.profile_edit_submissions s join candidates c using (politician_id)
),
timeline as (
    select t.* from public.timeline_entries t join candidates c using (politician_id)
),
queue as (
    select q.* from public.moderation_queue q join candidates c using (politician_id)
),
audit as (
    select a.* from public.curation_audit_events a
    where a.queue_id in (select queue_id from queue) or a.submission_id in (select submission_id from submissions)
),
accomplishments as (
    select a.* from public.politician_accomplishments a join candidates c using (politician_id)
),
news as (
    select n.* from public.news_politicians n join candidates c using (politician_id)
),
source_links as (
    select e.* from public.open_congress_entities e join candidates c using (politician_id)
),
backup as (
    select jsonb_build_object(
        'politicians', coalesce((select jsonb_agg(to_jsonb(p) order by p.politician_id)
            from public.politicians p where p.politician_id in (select politician_id from candidates union select id from roster)), '[]'),
        'open_congress_entities', coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from source_links s), '[]'),
        'profile_edit_submissions', coalesce((select jsonb_agg(to_jsonb(s) order by s.submission_id) from submissions s), '[]'),
        'timeline_entries', coalesce((select jsonb_agg(to_jsonb(t) order by t.timeline_id) from timeline t), '[]'),
        'moderation_queue', coalesce((select jsonb_agg(to_jsonb(q) order by q.queue_id) from queue q), '[]'),
        'curation_audit_events', coalesce((select jsonb_agg(to_jsonb(a) order by a.event_id) from audit a), '[]'),
        'politician_accomplishments', coalesce((select jsonb_agg(to_jsonb(a) order by a.accomplishment_id) from accomplishments a), '[]'),
        'news_politicians', coalesce((select jsonb_agg(to_jsonb(n) order by n.news_id, n.politician_id) from news n), '[]')
    ) as data
),
blockers as (
    select 'Roster includes duplicate profile IDs or offices' as issue
    where (select count(*) from roster) <> (select count(distinct id) from roster)
       or (select count(*) from roster) <> (select count(distinct position) from roster)
       or (select count(*) from historical_executives) <> (select count(distinct profile_id) from historical_executives)
    union all
    select 'Missing or archived reviewed identity: ' || r.name
    from roster r left join profiles p on p.politician_id=r.id
    where r.profile_id is not null and (p.politician_id is null or p.status='ARCHIVED')
    union all
    select 'New roster identity needs review: ' || r.name
    from roster r
    where r.profile_id is null and exists (
        select 1 from profiles p where p.politician_id=r.id
            or regexp_replace(lower(p.full_name), '[^[:alnum:]]', '', 'g') =
               regexp_replace(lower(r.name), '[^[:alnum:]]', '', 'g')
        union all
        select 1 from public.open_congress_entities e
        join public.open_congress_revisions v on (v.entity_id,v.revision)=(e.id,e.current_revision)
        where e.kind='PERSON' and e.politician_id is null and
            regexp_replace(lower(v.title), '[^[:alnum:]]', '', 'g') =
            regexp_replace(lower(r.name), '[^[:alnum:]]', '', 'g')
    )
    union all
    select 'Retained accountability rows cross-reference a deletion candidate'
    where exists (select 1 from public.timeline_entries t join submissions s using (submission_id)
                  where t.politician_id is distinct from s.politician_id)
       or exists (select 1 from timeline t join public.profile_edit_submissions s using (submission_id)
                  where t.politician_id is distinct from s.politician_id)
       or exists (select 1 from public.moderation_queue q join submissions s using (submission_id)
                  where q.politician_id is distinct from s.politician_id)
       or exists (select 1 from queue q join public.profile_edit_submissions s using (submission_id)
                  where q.politician_id is distinct from s.politician_id)
       or exists (select 1 from public.curation_audit_events a
                  join public.moderation_queue q using (queue_id)
                  join public.profile_edit_submissions s on s.submission_id=a.submission_id
                  where q.politician_id is distinct from s.politician_id and
                     (q.queue_id in (select queue_id from queue) or s.submission_id in (select submission_id from submissions)))
    union all
    select 'Unexpected inbound foreign key: ' || c.conrelid::regclass || '.' || c.conname
    from pg_constraint c
    where c.contype='f' and c.confrelid in (
        'public.politicians'::regclass, 'public.profile_edit_submissions'::regclass,
        'public.timeline_entries'::regclass, 'public.moderation_queue'::regclass,
        'public.curation_audit_events'::regclass, 'public.news_politicians'::regclass,
        'public.politician_accomplishments'::regclass)
    and (c.conrelid::regclass, c.confrelid::regclass, c.confdeltype::text) not in (
        ('public.open_congress_entities'::regclass, 'public.politicians'::regclass, 'r'),
        ('public.news_politicians'::regclass, 'public.politicians'::regclass, 'c'),
        ('public.politician_accomplishments'::regclass, 'public.politicians'::regclass, 'a'),
        ('public.moderation_queue'::regclass, 'public.politicians'::regclass, 'c'),
        ('public.moderation_queue'::regclass, 'public.profile_edit_submissions'::regclass, 'c'),
        ('public.profile_edit_submissions'::regclass, 'public.timeline_entries'::regclass, 'a'),
        ('public.moderation_queue'::regclass, 'public.timeline_entries'::regclass, 'a'),
        ('public.curation_audit_events'::regclass, 'public.moderation_queue'::regclass, 'r'),
        ('public.curation_audit_events'::regclass, 'public.profile_edit_submissions'::regclass, 'r'))
)
