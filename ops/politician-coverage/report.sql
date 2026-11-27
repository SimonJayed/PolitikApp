select jsonb_pretty(jsonb_build_object(
    'current_profiles', (select count(*) from profiles),
    'current_public_profiles', (select count(*) from profiles where status is distinct from 'ARCHIVED'),
    'eligible_for_deletion', (select count(*) from candidates),
    'retained_profiles', (select count(*) from profiles) - (select count(*) from candidates),
    'protected_executive_profiles', (select count(*) from profiles where executive and politician_id not in (select politician_id from candidates)),
    'protected_executive_profiles_with_older_only_memberships', (select count(*) from profiles
        where older_only and executive and politician_id not in (select politician_id from candidates)),
    'retained_with_recent_membership', (select count(*) from profiles where recent
        and politician_id not in (select politician_id from candidates)),
    'retained_without_confirmed_recent_or_exclusively_older_memberships',
        (select count(*) from profiles where not recent and not older_only
            and politician_id not in (select politician_id from candidates)),
    'executive_profiles_to_add', (select count(*) from roster where profile_id is null),
    'executive_profiles_to_reuse', (select count(*) from roster where profile_id is not null),
    'expected_final_profiles', (select count(*) from profiles) - (select count(*) from candidates)
        + (select count(*) from roster where profile_id is null),
    'expected_final_public_profiles', (select count(*) from profiles where status is distinct from 'ARCHIVED')
        - (select count(*) from candidates where status is distinct from 'ARCHIVED')
        + (select count(*) from roster where profile_id is null),
    'affected', jsonb_build_object(
        'open_congress_links_to_detach', (select count(*) from source_links),
        'open_congress_person_revisions_retained', (select count(*) from public.open_congress_revisions v join source_links s on s.id=v.entity_id),
        'open_congress_membership_relationships_retained', (select count(*) from public.open_congress_relationships r join source_links s
            on r.entity_id=s.id where r.relationship='MEMBER_OF'),
        'open_congress_bill_authorship_relationships_retained', (select count(*) from public.open_congress_relationships r join source_links s
            on r.target_id=s.id where r.relationship='AUTHORED_BY'),
        'timeline_entries_to_delete', (select count(*) from timeline),
        'profile_submissions_to_delete', (select count(*) from submissions),
        'moderation_queue_rows_to_delete', (select count(*) from queue),
        'curation_audit_events_to_delete', (select count(*) from audit),
        'accomplishments_to_delete', (select count(*) from accomplishments),
        'news_politician_associations_to_delete', (select count(*) from news),
        'article_bookmarks_on_linked_news_retained', (select count(*) from public.saved_posts where news_id in (select news_id from news)),
        'published_scoring_records_for_executive_profiles_to_reuse', (
            select count(*) from public.timeline_entries t join roster r on t.politician_id=r.profile_id
            where t.publication_status='PUBLISHED' and not t.is_hidden
              and t.action_identifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING')
        ) + (
            select count(*) from public.profile_edit_submissions s join roster r on s.politician_id=r.profile_id
            where s.status='PUBLISHED'
              and s.action_identifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING')
        )),
    'deletion_list', coalesce((select jsonb_agg(jsonb_build_object(
            'politician_id', politician_id, 'full_name', full_name, 'person_id', person_id,
            'congresses', congresses, 'status', status)
            || case when (select congress_only from scope) then jsonb_build_object('position', position,
                'executive_service', executive,
                'reason', case when older_only then 'Only pre-15th Congress memberships'
                    else 'No qualifying membership documented' end)
            when (select mayors_only from scope) then jsonb_build_object('position', position,
                'reason', 'Profile position is Mayor or Vice Mayor')
            else '{}'::jsonb end
            order by full_name, politician_id) from candidates), '[]'),
    'executive_roster', (select jsonb_agg(to_jsonb(r) order by r.position) from roster r),
    'verified_former_executive_exemptions', (select jsonb_agg(to_jsonb(h) order by h.name) from historical_executives h),
    'blockers', coalesce((select jsonb_agg(issue order by issue) from blockers), '[]'),
    'affected_rows_fingerprint', (select md5(data::text) from backup)
) || case when (select congress_only from scope) then jsonb_build_object(
    'scope', 'Retain only profiles with a documented membership from the 15th Congress onward',
    'candidates_with_executive_service', (select count(*) from candidates where executive),
    'candidates_with_older_only_memberships', (select count(*) from candidates where older_only),
    'candidates_without_confirmed_membership', (select count(*) from candidates where not older_only),
    'published_potential_scoring_timeline_rows_to_delete', (
        select count(*) from timeline t where t.publication_status='PUBLISHED' and not t.is_hidden
            and t.action_identifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING')),
    'published_potential_scoring_submissions_to_delete', (
        select count(*) from submissions s where s.status='PUBLISHED'
            and s.action_identifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING'))
) when (select mayors_only from scope) then jsonb_build_object(
    'scope', 'Profiles recorded as Mayor or Vice Mayor',
    'published_potential_scoring_timeline_rows_to_delete', (
        select count(*) from timeline t where t.publication_status='PUBLISHED' and not t.is_hidden
            and t.action_identifier in ('SPONSORED_LEGISLATION','PROJECT_COMPLETION','BUDGET_ALLOCATION','COA_FINDING'))
) else '{}'::jsonb end)
