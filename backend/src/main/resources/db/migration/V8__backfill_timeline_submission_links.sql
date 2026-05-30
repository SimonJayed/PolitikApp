-- Best-effort linkage for timeline entries published before submission_id existed.
UPDATE public.timeline_entries te
SET submission_id = pes.submission_id
FROM public.profile_edit_submissions pes
WHERE te.submission_id IS NULL
  AND pes.status IN ('PUBLISHED', 'APPEALED_PENDING')
  AND pes.politician_id = te.politician_id
  AND pes.category_tag = te.category_tag
  AND pes.action_identifier = te.action_identifier
  AND pes.impact_summary = te.summary
  AND COALESCE(pes.source_url, '') = COALESCE(te.source_url, '');
