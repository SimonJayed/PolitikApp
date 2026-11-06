-- Flyway Database Migration: V14__admin_curation_and_challenges
-- Centralizes moderation to Admin-Curator model and introduces Citizen Public Challenges

-- 1. Safely migrate existing rows to the new status vocabulary
UPDATE public.profile_edit_submissions
SET status = CASE
  WHEN status IN ('SUBMITTED', 'PENDING', 'JURY_REVIEW') THEN 'SUBMITTED_REQUEST'
  WHEN status = 'REJECTED' THEN 'RESOLVED_DISMISSED'
  WHEN status IN ('ESCALATED', 'APPEALED_PENDING', 'REVISION_REQUIRED') THEN 'UNDER_REVIEW'
  WHEN status = 'PUBLISHED' THEN 'PUBLISHED'
  ELSE 'SUBMITTED_REQUEST'
END
WHERE status NOT IN ('SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED');

UPDATE public.moderation_queue
SET queue_status = CASE
  WHEN queue_status IN ('SUBMITTED', 'PENDING', 'JURY_REVIEW') THEN 'SUBMITTED_REQUEST'
  WHEN queue_status = 'REJECTED' THEN 'RESOLVED_DISMISSED'
  WHEN queue_status IN ('ESCALATED', 'APPEALED_PENDING', 'REVISION_REQUIRED') THEN 'UNDER_REVIEW'
  WHEN queue_status = 'PUBLISHED' THEN 'PUBLISHED'
  ELSE 'SUBMITTED_REQUEST'
END
WHERE queue_status NOT IN ('SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED');

-- 2. Drop and recreate check constraints with new statuses
ALTER TABLE public.profile_edit_submissions DROP CONSTRAINT IF EXISTS profile_edit_submissions_status_check;
ALTER TABLE public.profile_edit_submissions ADD CONSTRAINT profile_edit_submissions_status_check CHECK (
  status IN ('SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED')
);

ALTER TABLE public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_status_check;
ALTER TABLE public.moderation_queue ADD CONSTRAINT moderation_queue_status_check CHECK (
  queue_status IN ('SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED')
);

-- 3. Add challenge tracking columns to moderation_queue and profile_edit_submissions
ALTER TABLE public.moderation_queue
  ADD COLUMN IF NOT EXISTS challenge_target_id UUID,
  ADD COLUMN IF NOT EXISTS challenge_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

ALTER TABLE public.profile_edit_submissions
  ADD COLUMN IF NOT EXISTS challenge_target_id UUID,
  ADD COLUMN IF NOT EXISTS challenge_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- 4. Add mandatory verification and citation columns
ALTER TABLE public.profile_edit_submissions
  ADD COLUMN IF NOT EXISTS primary_source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS primary_source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 5. Backfill primary_source_url from source_url
UPDATE public.profile_edit_submissions
SET primary_source_url = source_url
WHERE primary_source_url IS NULL AND source_url IS NOT NULL;

UPDATE public.timeline_entries
SET primary_source_url = source_url
WHERE primary_source_url IS NULL AND source_url IS NOT NULL;

-- 6. Add indexes for challenge queries
CREATE INDEX IF NOT EXISTS idx_moderation_queue_challenge_target_id
  ON public.moderation_queue(challenge_target_id);

CREATE INDEX IF NOT EXISTS idx_submissions_challenge_target_id
  ON public.profile_edit_submissions(challenge_target_id);
