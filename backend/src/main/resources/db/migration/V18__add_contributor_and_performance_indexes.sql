-- ============================================================================
-- Flyway migration: V18__add_contributor_and_performance_indexes.sql
-- Add performance indexes for contributor submissions and moderation queue joins.
-- ============================================================================

-- 1. Index contributor_id on profile_edit_submissions to optimize /api/submissions/my queries
CREATE INDEX IF NOT EXISTS idx_profile_edit_submissions_contributor_id
  ON public.profile_edit_submissions(contributor_id);

-- 2. Index foreign keys on moderation_queue to accelerate batch adjudication lookups
CREATE INDEX IF NOT EXISTS idx_moderation_queue_submission_id
  ON public.moderation_queue(submission_id);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_politician_id
  ON public.moderation_queue(politician_id);
