-- Flyway Database Migration: V4__add_missing_statuses_to_constraints
-- Author: Capstone Engineering Team

-- 1. Drop existing check constraints
ALTER TABLE public.profile_edit_submissions DROP CONSTRAINT IF EXISTS profile_edit_submissions_status_check;
ALTER TABLE public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_status_check;

-- 2. Add updated check constraints supporting the full 5-stage progress lifecycle values
ALTER TABLE public.profile_edit_submissions ADD CONSTRAINT profile_edit_submissions_status_check CHECK (
  status IN ('SUBMITTED', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'PUBLISHED', 'REJECTED')
);

ALTER TABLE public.moderation_queue ADD CONSTRAINT moderation_queue_status_check CHECK (
  queue_status IN ('PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'PUBLISHED', 'REJECTED')
);
