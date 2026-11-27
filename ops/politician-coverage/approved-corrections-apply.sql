insert into public.politicians(politician_id, full_name, position, jurisdiction, status,
    term_start, biography, profile_origin, created_at, updated_at)
select id, name, position, 'NATIONAL', 'ACTIVE', term_start, biography, 'ADMIN_CURATED', now(), now()
from new_secretaries;

update public.timeline_entries t set
    source_url=case when c.operation='edit' then c.source else t.source_url end,
    summary=case when c.operation='edit' then coalesce(c.summary, t.summary) else t.summary end,
    action_details=case when c.operation='edit' then t.action_details || c.details else t.action_details end,
    publication_status=case when c.operation='withdraw' then 'RESOLVED_DISMISSED' else t.publication_status end,
    is_hidden=case when c.operation='withdraw' then true else t.is_hidden end,
    verification_notes=concat_ws(E'\n\n', nullif(t.verification_notes,''), '[2026-11-27] ' || c.note),
    updated_at=now()
from record_changes c where t.timeline_id=c.timeline_id;

update public.profile_edit_submissions s set
    source_url=case when c.operation='edit' then c.source else s.source_url end,
    impact_summary=case when c.operation='edit' then coalesce(c.summary, s.impact_summary) else s.impact_summary end,
    action_details=case when c.operation='edit' then s.action_details || c.details else s.action_details end,
    status=case when c.operation='withdraw' then 'RESOLVED_DISMISSED' else s.status end,
    admin_resolution_notes=case when c.operation='withdraw'
        then concat_ws(E'\n\n', nullif(s.admin_resolution_notes,''), '[2026-11-27] ' || c.note) else s.admin_resolution_notes end,
    resolved_at=case when c.operation='withdraw' then now() else s.resolved_at end,
    verification_notes=concat_ws(E'\n\n', nullif(s.verification_notes,''), '[2026-11-27] ' || c.note),
    updated_at=now()
from record_changes c where s.submission_id=c.submission_id;

do $checks$
begin
    if (select count(*) from public.politicians) <> 970 or (
        select count(*) from public.politicians where position like 'EXECUTIVE\_SECRETARY\_OF\_%' and status='ACTIVE'
    ) <> 23 or exists (
        select 1 from new_secretaries n left join public.politicians p on p.politician_id=n.id
        where p.full_name is distinct from n.name or p.position is distinct from n.position
           or p.biography is distinct from n.biography or p.term_start is distinct from n.term_start
           or p.term_end is not null or p.profile_origin is distinct from 'ADMIN_CURATED'
    ) or exists (
        select 1 from public.timeline_entries t join new_secretaries n on t.politician_id=n.id
    ) or exists (
        select 1 from public.profile_edit_submissions s join new_secretaries n on s.politician_id=n.id
    ) or exists (
        select 1 from public.politician_accomplishments a join new_secretaries n on a.politician_id=n.id
    ) then
        raise exception 'Cabinet profile postconditions failed';
    end if;
    if exists (
        select 1 from record_changes c join public.timeline_entries t using(timeline_id)
        left join public.profile_edit_submissions s on s.submission_id=c.submission_id
        where t.updated_at is distinct from now() or position(c.note in t.verification_notes)=0
           or (c.submission is not null and (s.updated_at is distinct from now() or position(c.note in s.verification_notes)=0))
           or (c.operation='withdraw' and (not t.is_hidden or t.publication_status <> 'RESOLVED_DISMISSED'
               or (c.submission is not null and s.status <> 'RESOLVED_DISMISSED')))
           or (c.operation='edit' and (t.is_hidden or t.publication_status <> 'PUBLISHED' or t.source_url <> c.source
               or not (t.action_details @> c.details) or (c.submission is not null and
                   (s.status <> 'PUBLISHED' or s.source_url <> c.source or not (s.action_details @> c.details)))))
    ) then
        raise exception 'Accountability postconditions failed';
    end if;
end
$checks$;
