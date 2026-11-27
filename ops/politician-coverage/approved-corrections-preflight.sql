do $checks$
begin
    if (select count(*) from public.politicians) <> 952
       or (select count(*) from new_secretaries) <> 18
       or (select count(*) from record_changes) <> 20
       or (select count(*) from record_changes where submission is not null) <> 14
       or to_regclass('public.citation_reviews') is not null then
        raise exception 'The approved batch or baseline has changed';
    end if;
    if exists (
        select 1 from public.politicians p join new_secretaries n
          on p.politician_id=n.id or (p.status='ACTIVE' and p.position=n.position)
          or n.names ? btrim(regexp_replace(lower(regexp_replace(p.full_name, '"[^"]*"', '', 'g')), '[^a-z]+', ' ', 'g'))
    ) then
        raise exception 'A candidate identity or active position already exists';
    end if;
    if exists (
        select 1 from record_changes c left join public.timeline_entries t on t.timeline_id=c.timeline_id
        where t.timeline_id is null or t.publication_status is distinct from 'PUBLISHED'
           or t.is_hidden is distinct from false
           or t.politician_id is distinct from (c.timeline->>'politician_id')::uuid
           or t.submission_id is distinct from (c.timeline->>'submission_id')::uuid
           or t.updated_at is distinct from (c.timeline->>'updated_at')::timestamptz
           or t.action_identifier is distinct from c.timeline->>'action_identifier'
           or t.source_url is distinct from c.timeline->>'source_url'
           or t.summary is distinct from c.timeline->>'summary'
           or t.action_details is distinct from c.timeline->'action_details'
           or t.action_details ?| array['sourceReported', 'sourceKey', 'openCongressId']
    ) then
        raise exception 'At least one approved timeline row changed';
    end if;
    if exists (
        select 1 from record_changes c left join public.profile_edit_submissions s on s.submission_id=c.submission_id
        where (c.submission is null) is distinct from (s.submission_id is null)
           or (c.submission is not null and (
               s.status is distinct from 'PUBLISHED'
               or s.politician_id is distinct from (c.submission->>'politician_id')::uuid
               or s.updated_at is distinct from (c.submission->>'updated_at')::timestamptz
               or s.action_identifier is distinct from c.submission->>'action_identifier'
               or s.source_url is distinct from c.submission->>'source_url'
               or s.impact_summary is distinct from c.submission->>'impact_summary'
               or s.action_details is distinct from c.submission->'action_details'
               or (select count(*) from public.timeline_entries t where t.submission_id=c.submission_id) <> 1
           ))
    ) then
        raise exception 'At least one linked submission changed';
    end if;
    if (select count(*) from public.timeline_entries where timeline_id in (
        'eb4246a7-88b9-39f0-86df-875b31ed19fa', '6b885576-3291-3bd0-96f4-5883a06e772a'
    ) and publication_status='DRAFT' and source_url is null) <> 2 then
        raise exception 'The two unpublished Congress drafts differ from the audited state';
    end if;
end
$checks$;
