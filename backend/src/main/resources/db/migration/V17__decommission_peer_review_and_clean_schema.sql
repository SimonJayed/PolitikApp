-- ============================================================================
-- Flyway migration: V17__decommission_peer_review_and_clean_schema.sql
-- Remove obsolete 1.0 peer review artifacts and prune stale legacy columns.
-- ============================================================================

-- 1. Drop obsolete peer-review table and dependent indexes/constraints.
DROP TABLE IF EXISTS public.jury_votes CASCADE;

-- 2. Drop legacy V15 sync triggers and helper functions created for older metric mirroring.
DROP TRIGGER IF EXISTS sync_submission_metric_trigger ON public.profile_edit_submissions;
DROP TRIGGER IF EXISTS sync_timeline_metric_trigger ON public.timeline_entries;
DROP FUNCTION IF EXISTS public.sync_submission_action_details_metric() CASCADE;
DROP FUNCTION IF EXISTS public.safe_json_to_numeric(text) CASCADE;

-- 3. Backfill canonical source_url values before removing deprecated primary_source_url fields.
UPDATE public.profile_edit_submissions
SET source_url = primary_source_url
WHERE source_url IS NULL AND primary_source_url IS NOT NULL;

UPDATE public.timeline_entries
SET source_url = primary_source_url
WHERE source_url IS NULL AND primary_source_url IS NOT NULL;

-- 4. Remove legacy metric columns from the submission and timeline tables.
ALTER TABLE public.profile_edit_submissions
  DROP COLUMN IF EXISTS quantitative_metric,
  DROP COLUMN IF EXISTS primary_source_url;

ALTER TABLE public.timeline_entries
  DROP COLUMN IF EXISTS quantitative_metric,
  DROP COLUMN IF EXISTS primary_source_url;

-- 5. Remove retired moderation columns.
ALTER TABLE public.moderation_queue
  DROP COLUMN IF EXISTS escalation_flag,
  DROP COLUMN IF EXISTS appealer_id;

-- 6. Remove retired contributor columns that belonged to the legacy trust sandbox model.
ALTER TABLE public.contributors
  DROP CONSTRAINT IF EXISTS contributors_trust_score_range_check,
  DROP CONSTRAINT IF EXISTS contributors_writing_token_status_check,
  DROP COLUMN IF EXISTS trust_score,
  DROP COLUMN IF EXISTS writing_token_status,
  DROP COLUMN IF EXISTS sandbox_profile_metrics;

-- 7. Normalize contributor roles to the current canonical set.
UPDATE public.contributors
SET role = 'CONTRIBUTOR'
WHERE role = 'PEER' OR role NOT IN ('CONTRIBUTOR', 'ADMIN', 'ADMINISTRATOR');

ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_role_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_role_check
  CHECK (role IN ('CONTRIBUTOR', 'ADMIN', 'ADMINISTRATOR'));

-- 8. Optional cleanup: remove the legacy sandbox-spoofer row if it is no longer referenced.
DELETE FROM public.contributors
WHERE contributor_id = '88bc8912-43ba-4abc-882a-ef92481aa323'
  AND NOT EXISTS (
    SELECT 1
    FROM public.profile_edit_submissions
    WHERE contributor_id = '88bc8912-43ba-4abc-882a-ef92481aa323'
  );
