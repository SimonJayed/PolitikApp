-- Flyway Database Migration: V7__add_appealed_status_to_constraints
-- Adds the post-publish appeal state and audit-preserving timeline linkage.

ALTER TABLE public.profile_edit_submissions DROP CONSTRAINT IF EXISTS profile_edit_submissions_status_check;
ALTER TABLE public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_status_check;

ALTER TABLE public.profile_edit_submissions ADD CONSTRAINT profile_edit_submissions_status_check CHECK (
  status IN ('SUBMITTED', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'PUBLISHED', 'REJECTED')
);

ALTER TABLE public.moderation_queue ADD CONSTRAINT moderation_queue_status_check CHECK (
  queue_status IN ('PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'PUBLISHED', 'REJECTED')
);

ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS submission_id uuid,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.moderation_queue
  ADD COLUMN IF NOT EXISTS appealer_id uuid;

CREATE INDEX IF NOT EXISTS idx_timeline_entries_submission_id
  ON public.timeline_entries(submission_id);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_appealer_id
  ON public.moderation_queue(appealer_id);
