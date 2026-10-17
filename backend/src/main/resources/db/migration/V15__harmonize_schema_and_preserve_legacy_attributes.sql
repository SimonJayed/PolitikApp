-- ============================================================================
-- Flyway Database Migration: V15__harmonize_schema_and_preserve_legacy_attributes
-- Author: Capstone Engineering Team
-- Date: 2026-09-06
-- Purpose:
--   1. Restore and retain legacy quantitative_metric as a nullable column alongside
--      action_details JSONB on profile_edit_submissions and timeline_entries.
--   2. Deploy safe_json_to_numeric helper function and bidirectional sync triggers
--      to guarantee zero runtime numeric casting exceptions.
--   3. Harmonize status check constraints to accept the full superset of legacy
--      and modern curation lifecycle states, preventing check constraint violations.
-- ============================================================================

-- 1. Helper function for safe JSON-to-numeric extraction
CREATE OR REPLACE FUNCTION public.safe_json_to_numeric(val text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_val text;
BEGIN
  IF val IS NULL OR trim(val) = '' THEN
    RETURN NULL;
  END IF;

  -- Strip common formatting symbols (currency symbols, commas, spaces)
  clean_val := trim(regexp_replace(val, '[$, ]', '', 'g'));

  BEGIN
    RETURN clean_val::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- 2. Restore quantitative_metric column if missing (e.g., dropped by V6) and expand type to NUMERIC
ALTER TABLE public.profile_edit_submissions
  ADD COLUMN IF NOT EXISTS quantitative_metric NUMERIC;

ALTER TABLE public.profile_edit_submissions
  ALTER COLUMN quantitative_metric TYPE NUMERIC;

ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS quantitative_metric NUMERIC;

ALTER TABLE public.timeline_entries
  ALTER COLUMN quantitative_metric TYPE NUMERIC;

-- Ensure quantitative_metric is nullable
ALTER TABLE public.profile_edit_submissions
  ALTER COLUMN quantitative_metric DROP NOT NULL;

ALTER TABLE public.timeline_entries
  ALTER COLUMN quantitative_metric DROP NOT NULL;

-- 3. Backfill quantitative_metric from action_details JSONB if currently null
UPDATE public.profile_edit_submissions
SET quantitative_metric = COALESCE(
  public.safe_json_to_numeric(action_details->>'flaggedAmount'),
  public.safe_json_to_numeric(action_details->>'allocationAmount'),
  public.safe_json_to_numeric(action_details->>'metric'),
  public.safe_json_to_numeric(action_details->>'completionPercentage')
)
WHERE quantitative_metric IS NULL AND action_details IS NOT NULL;

UPDATE public.timeline_entries
SET quantitative_metric = COALESCE(
  public.safe_json_to_numeric(action_details->>'flaggedAmount'),
  public.safe_json_to_numeric(action_details->>'allocationAmount'),
  public.safe_json_to_numeric(action_details->>'metric'),
  public.safe_json_to_numeric(action_details->>'completionPercentage')
)
WHERE quantitative_metric IS NULL AND action_details IS NOT NULL;

-- 4. Deploy bidirectional synchronization triggers
CREATE OR REPLACE FUNCTION public.sync_submission_action_details_metric()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  extracted_metric numeric;
BEGIN
  IF NEW.action_details IS NOT NULL AND NEW.action_details != '{}'::jsonb THEN
    extracted_metric := COALESCE(
      public.safe_json_to_numeric(NEW.action_details->>'flaggedAmount'),
      public.safe_json_to_numeric(NEW.action_details->>'allocationAmount'),
      public.safe_json_to_numeric(NEW.action_details->>'metric'),
      public.safe_json_to_numeric(NEW.action_details->>'completionPercentage')
    );

    IF extracted_metric IS NOT NULL THEN
      NEW.quantitative_metric := extracted_metric;
    END IF;
  ELSIF NEW.quantitative_metric IS NOT NULL THEN
    NEW.action_details := jsonb_build_object('metric', NEW.quantitative_metric);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_submissions_metric_trigger ON public.profile_edit_submissions;
CREATE TRIGGER sync_submissions_metric_trigger
  BEFORE INSERT OR UPDATE ON public.profile_edit_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_submission_action_details_metric();

DROP TRIGGER IF EXISTS sync_timeline_metric_trigger ON public.timeline_entries;
CREATE TRIGGER sync_timeline_metric_trigger
  BEFORE INSERT OR UPDATE ON public.timeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_submission_action_details_metric();

-- 5. Harmonize status check constraints to superset of all valid states
-- Normalize contributors
UPDATE public.contributors
SET account_status = CASE
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('LOCKED') THEN 'LOCKED'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('SUSPENDED', 'BANNED', 'DEACTIVATED') THEN 'SUSPENDED'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('INACTIVE') THEN 'INACTIVE'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('PENDING') THEN 'PENDING'
  ELSE 'ACTIVE'
END;

ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_account_status_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_account_status_check
  CHECK (account_status IN ('ACTIVE', 'LOCKED', 'SUSPENDED', 'INACTIVE', 'PENDING'));

-- Normalize submissions status
UPDATE public.profile_edit_submissions
SET status = CASE
  WHEN UPPER(TRIM(COALESCE(status, ''))) IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ) THEN UPPER(TRIM(status))
  ELSE 'SUBMITTED_REQUEST'
END;

ALTER TABLE public.profile_edit_submissions DROP CONSTRAINT IF EXISTS profile_edit_submissions_status_check;
ALTER TABLE public.profile_edit_submissions ADD CONSTRAINT profile_edit_submissions_status_check
  CHECK (status IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ));

-- Normalize queue status
UPDATE public.moderation_queue
SET queue_status = CASE
  WHEN UPPER(TRIM(COALESCE(queue_status, ''))) IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ) THEN UPPER(TRIM(queue_status))
  ELSE 'SUBMITTED_REQUEST'
END;

ALTER TABLE public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_status_check;
ALTER TABLE public.moderation_queue ADD CONSTRAINT moderation_queue_status_check
  CHECK (queue_status IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ));

-- Normalize timeline publication status
UPDATE public.timeline_entries
SET publication_status = CASE
  WHEN UPPER(TRIM(COALESCE(publication_status, ''))) IN ('DRAFT', 'PUBLISHED', 'RESOLVED_DISMISSED', 'ARCHIVED')
    THEN UPPER(TRIM(publication_status))
  ELSE 'PUBLISHED'
END;

ALTER TABLE public.timeline_entries DROP CONSTRAINT IF EXISTS timeline_entries_publication_status_check;
ALTER TABLE public.timeline_entries ADD CONSTRAINT timeline_entries_publication_status_check
  CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'RESOLVED_DISMISSED', 'ARCHIVED'));
