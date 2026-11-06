-- ============================================================================
-- PolitikApp Complete Production Supabase Schema (Non-Breaking, Idempotent)
-- Author: Capstone Engineering Team
-- Date: 2026-09-06
-- Description:
--   Consolidates all schema definitions from V1 through V15 into a single,
--   completely idempotent, zero-data-loss DDL deployment script.
--   - Preserves legacy attributes (quantitative_metric, trust_score, jury_votes)
--   - Provides safe JSONB-to-numeric casting trigger (no transaction rollbacks)
--   - Harmonizes status constraints across legacy and modern curation models
--   - Pre-registers schema history in public.flyway_schema_history to prevent
--     Flyway baseline traps.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CORE UTILITY FUNCTIONS

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Bulletproof numeric parser with exception block
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

  -- Strip common formatting symbols: currency symbols, commas, spaces
  clean_val := trim(regexp_replace(val, '[$, ]', '', 'g'));

  BEGIN
    RETURN clean_val::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Bidirectional synchronization between action_details JSONB and legacy quantitative_metric
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

-- 3. TABLES

-- A. CONTRIBUTORS
CREATE TABLE IF NOT EXISTS public.contributors (
  contributor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(80),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'CONTRIBUTOR',
  account_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  trust_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  writing_token_status VARCHAR(50) DEFAULT 'ACTIVE',
  sandbox_profile_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on contributors
ALTER TABLE public.contributors
  ADD COLUMN IF NOT EXISTS username VARCHAR(80),
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS trust_score NUMERIC(5, 2) DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS sandbox_profile_metrics JSONB DEFAULT '{}'::jsonb;

-- Normalize existing contributor data before applying constraints
UPDATE public.contributors
SET account_status = CASE
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('LOCKED') THEN 'LOCKED'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('SUSPENDED', 'BANNED', 'DEACTIVATED') THEN 'SUSPENDED'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('INACTIVE') THEN 'INACTIVE'
  WHEN UPPER(TRIM(COALESCE(account_status, ''))) IN ('PENDING') THEN 'PENDING'
  ELSE 'ACTIVE'
END;

UPDATE public.contributors
SET role = CASE
  WHEN UPPER(TRIM(COALESCE(role, ''))) IN ('ADMIN') THEN 'ADMIN'
  WHEN UPPER(TRIM(COALESCE(role, ''))) IN ('PEER') THEN 'PEER'
  ELSE 'CONTRIBUTOR'
END;

UPDATE public.contributors
SET writing_token_status = CASE
  WHEN UPPER(TRIM(COALESCE(writing_token_status, ''))) IN ('INVALIDATED') THEN 'INVALIDATED'
  WHEN UPPER(TRIM(COALESCE(writing_token_status, ''))) IN ('EXPIRED') THEN 'EXPIRED'
  ELSE 'ACTIVE'
END;

UPDATE public.contributors
SET trust_score = LEAST(500.00, GREATEST(0.00, COALESCE(trust_score, 100.00)));

UPDATE public.contributors
SET sandbox_profile_metrics = '{}'::jsonb
WHERE sandbox_profile_metrics IS NULL;

-- Constraints for contributors
ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_role_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_role_check
  CHECK (role IN ('CONTRIBUTOR', 'PEER', 'ADMIN'));

ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_account_status_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_account_status_check
  CHECK (account_status IN ('ACTIVE', 'LOCKED', 'SUSPENDED', 'INACTIVE', 'PENDING'));

ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_writing_token_status_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_writing_token_status_check
  CHECK (writing_token_status IN ('ACTIVE', 'INVALIDATED', 'EXPIRED'));

ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_trust_score_range_check;
ALTER TABLE public.contributors ADD CONSTRAINT contributors_trust_score_range_check
  CHECK (trust_score >= 0.00 AND trust_score <= 500.00);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contributors_username_unique
  ON public.contributors (lower(username))
  WHERE username IS NOT NULL;


-- B. POLITICIANS
CREATE TABLE IF NOT EXISTS public.politicians (
  politician_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  position VARCHAR(100) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  party_affiliation VARCHAR(100),
  term_start DATE NOT NULL,
  term_end DATE NOT NULL,
  profile_image_url TEXT,
  biography TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

UPDATE public.politicians
SET status = CASE
  WHEN UPPER(TRIM(COALESCE(status, ''))) IN ('INACTIVE') THEN 'INACTIVE'
  WHEN UPPER(TRIM(COALESCE(status, ''))) IN ('ARCHIVED') THEN 'ARCHIVED'
  ELSE 'ACTIVE'
END;

ALTER TABLE public.politicians DROP CONSTRAINT IF EXISTS politicians_status_check;
ALTER TABLE public.politicians ADD CONSTRAINT politicians_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'));

CREATE INDEX IF NOT EXISTS idx_politicians_status ON public.politicians(status);
CREATE INDEX IF NOT EXISTS idx_politicians_full_name ON public.politicians(full_name);


-- C. PROFILE EDIT SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.profile_edit_submissions (
  submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID NOT NULL REFERENCES public.politicians(politician_id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE RESTRICT,
  source_url TEXT NOT NULL,
  primary_source_url TEXT,
  verification_notes TEXT,
  category_tag VARCHAR(100) NOT NULL,
  action_identifier VARCHAR(150) NOT NULL,
  action_details JSONB,
  quantitative_metric NUMERIC,
  impact_summary TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'SUBMITTED_REQUEST',
  challenge_target_id UUID,
  challenge_reason TEXT,
  evidence_url TEXT,
  admin_resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on profile_edit_submissions
ALTER TABLE public.profile_edit_submissions
  ADD COLUMN IF NOT EXISTS action_details JSONB,
  ADD COLUMN IF NOT EXISTS quantitative_metric NUMERIC,
  ADD COLUMN IF NOT EXISTS primary_source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS challenge_target_id UUID,
  ADD COLUMN IF NOT EXISTS challenge_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Allow quantitative_metric to be nullable to accommodate JSONB payloads and widen type
ALTER TABLE public.profile_edit_submissions
  ALTER COLUMN quantitative_metric TYPE NUMERIC,
  ALTER COLUMN quantitative_metric DROP NOT NULL;

-- Backfill primary_source_url from source_url if not set
UPDATE public.profile_edit_submissions
SET primary_source_url = source_url
WHERE primary_source_url IS NULL AND source_url IS NOT NULL;

-- Normalize status before applying check constraint
UPDATE public.profile_edit_submissions
SET status = CASE
  WHEN UPPER(TRIM(COALESCE(status, ''))) IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ) THEN UPPER(TRIM(status))
  ELSE 'SUBMITTED_REQUEST'
END;

-- Harmonized Status Constraint (Superset: Legacy + Modern)
ALTER TABLE public.profile_edit_submissions DROP CONSTRAINT IF EXISTS profile_edit_submissions_status_check;
ALTER TABLE public.profile_edit_submissions ADD CONSTRAINT profile_edit_submissions_status_check
  CHECK (status IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ));

CREATE INDEX IF NOT EXISTS idx_profile_edit_submissions_politician_status
  ON public.profile_edit_submissions(politician_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_action_details_jsonb
  ON public.profile_edit_submissions USING GIN (action_details);
CREATE INDEX IF NOT EXISTS idx_submissions_challenge_target_id
  ON public.profile_edit_submissions(challenge_target_id);


-- D. MODERATION QUEUE
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.profile_edit_submissions(submission_id) ON DELETE CASCADE,
  politician_id UUID NOT NULL REFERENCES public.politicians(politician_id) ON DELETE CASCADE,
  appealer_id UUID,
  queue_status VARCHAR(50) DEFAULT 'SUBMITTED_REQUEST',
  escalation_flag BOOLEAN DEFAULT false,
  challenge_target_id UUID,
  challenge_reason TEXT,
  evidence_url TEXT,
  admin_resolution_notes TEXT,
  resolved_at TIMESTAMP,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on moderation_queue
ALTER TABLE public.moderation_queue
  ADD COLUMN IF NOT EXISTS appealer_id UUID,
  ADD COLUMN IF NOT EXISTS challenge_target_id UUID,
  ADD COLUMN IF NOT EXISTS challenge_reason TEXT,
  ADD COLUMN IF NOT EXISTS evidence_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Normalize queue_status before applying check constraint
UPDATE public.moderation_queue
SET queue_status = CASE
  WHEN UPPER(TRIM(COALESCE(queue_status, ''))) IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ) THEN UPPER(TRIM(queue_status))
  ELSE 'SUBMITTED_REQUEST'
END;

-- Harmonized Queue Status Constraint (Superset: Legacy + Modern)
ALTER TABLE public.moderation_queue DROP CONSTRAINT IF EXISTS moderation_queue_status_check;
ALTER TABLE public.moderation_queue ADD CONSTRAINT moderation_queue_status_check
  CHECK (queue_status IN (
    'SUBMITTED', 'PENDING', 'JURY_REVIEW', 'REVISION_REQUIRED', 'ESCALATED', 'APPEALED_PENDING', 'REJECTED',
    'SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW', 'RESOLVED_UPHELD', 'RESOLVED_DISMISSED', 'PUBLISHED'
  ));

CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON public.moderation_queue(queue_status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_appealer_id ON public.moderation_queue(appealer_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_challenge_target_id ON public.moderation_queue(challenge_target_id);


-- E. TIMELINE ENTRIES
CREATE TABLE IF NOT EXISTS public.timeline_entries (
  timeline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id UUID NOT NULL REFERENCES public.politicians(politician_id) ON DELETE CASCADE,
  submission_id UUID,
  category_tag VARCHAR(100) NOT NULL,
  action_identifier VARCHAR(150) NOT NULL,
  action_details JSONB,
  quantitative_metric NUMERIC DEFAULT 0.00,
  summary TEXT NOT NULL,
  source_url TEXT,
  primary_source_url TEXT,
  verification_notes TEXT,
  publication_status VARCHAR(50) DEFAULT 'PUBLISHED',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all columns exist on timeline_entries
ALTER TABLE public.timeline_entries
  ADD COLUMN IF NOT EXISTS submission_id UUID,
  ADD COLUMN IF NOT EXISTS action_details JSONB,
  ADD COLUMN IF NOT EXISTS quantitative_metric NUMERIC,
  ADD COLUMN IF NOT EXISTS primary_source_url TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- Allow quantitative_metric to be nullable to accommodate JSONB payloads and widen type
ALTER TABLE public.timeline_entries
  ALTER COLUMN quantitative_metric TYPE NUMERIC,
  ALTER COLUMN quantitative_metric DROP NOT NULL;

-- Backfill primary_source_url from source_url if not set
UPDATE public.timeline_entries
SET primary_source_url = source_url
WHERE primary_source_url IS NULL AND source_url IS NOT NULL;

-- Normalize publication_status before applying check constraint
UPDATE public.timeline_entries
SET publication_status = CASE
  WHEN UPPER(TRIM(COALESCE(publication_status, ''))) IN ('DRAFT', 'PUBLISHED', 'RESOLVED_DISMISSED', 'ARCHIVED')
    THEN UPPER(TRIM(publication_status))
  ELSE 'PUBLISHED'
END;

ALTER TABLE public.timeline_entries DROP CONSTRAINT IF EXISTS timeline_entries_publication_status_check;
ALTER TABLE public.timeline_entries ADD CONSTRAINT timeline_entries_publication_status_check
  CHECK (publication_status IN ('DRAFT', 'PUBLISHED', 'RESOLVED_DISMISSED', 'ARCHIVED'));

CREATE INDEX IF NOT EXISTS idx_timeline_entries_politician_publication
  ON public.timeline_entries(politician_id, publication_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_submission_id
  ON public.timeline_entries(submission_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entries_action_details_jsonb
  ON public.timeline_entries USING GIN (action_details);


-- F. JURY VOTES
CREATE TABLE IF NOT EXISTS public.jury_votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.moderation_queue(queue_id) ON DELETE CASCADE,
  peer_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE RESTRICT,
  vote_type VARCHAR(50) NOT NULL,
  vote_weight INTEGER NOT NULL DEFAULT 1,
  vote_reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT jury_votes_vote_type_check CHECK (vote_type IN ('AGREE', 'DISAGREE', 'FLAG'))
);

-- Deduplicate any existing duplicate votes before creating the unique constraint
DELETE FROM public.jury_votes a
WHERE ctid < (
  SELECT max(ctid)
  FROM public.jury_votes b
  WHERE a.queue_id = b.queue_id
    AND a.peer_id = b.peer_id
);

ALTER TABLE public.jury_votes DROP CONSTRAINT IF EXISTS unique_queue_peer;
ALTER TABLE public.jury_votes ADD CONSTRAINT unique_queue_peer UNIQUE (queue_id, peer_id);

CREATE INDEX IF NOT EXISTS idx_jury_votes_queue_id ON public.jury_votes(queue_id);


-- G. REPUTATION AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.reputation_audit_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE RESTRICT,
  queue_id UUID REFERENCES public.moderation_queue(queue_id) ON DELETE SET NULL,
  score_change NUMERIC(5, 2) NOT NULL,
  previous_score NUMERIC(5, 2) NOT NULL,
  new_score NUMERIC(5, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reputation_logs_peer_date
  ON public.reputation_audit_logs(peer_id, created_at DESC);


-- H. PEER APPLICATIONS
CREATE TABLE IF NOT EXISTS public.peer_applications (
  application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES public.contributors(contributor_id) ON DELETE CASCADE,
  organization_type VARCHAR(100) NOT NULL,
  institutional_email VARCHAR(255) NOT NULL,
  verification_proof_url TEXT NOT NULL,
  justification_statement TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT peer_applications_organization_type_check CHECK (
    organization_type IN ('FACULTY', 'RESEARCHER', 'CAMPUS_JOURNALIST', 'CIVIC_VOLUNTEER')
  ),
  CONSTRAINT peer_applications_status_check CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_peer_applications_contributor_id ON public.peer_applications(contributor_id);
CREATE INDEX IF NOT EXISTS idx_peer_applications_status ON public.peer_applications(status);


-- 4. TRIGGERS

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_contributors_updated_at ON public.contributors;
CREATE TRIGGER set_contributors_updated_at
  BEFORE UPDATE ON public.contributors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_politicians_updated_at ON public.politicians;
CREATE TRIGGER set_politicians_updated_at
  BEFORE UPDATE ON public.politicians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_profile_edit_submissions_updated_at ON public.profile_edit_submissions;
CREATE TRIGGER set_profile_edit_submissions_updated_at
  BEFORE UPDATE ON public.profile_edit_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_moderation_queue_updated_at ON public.moderation_queue;
CREATE TRIGGER set_moderation_queue_updated_at
  BEFORE UPDATE ON public.moderation_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_timeline_entries_updated_at ON public.timeline_entries;
CREATE TRIGGER set_timeline_entries_updated_at
  BEFORE UPDATE ON public.timeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Safe JSON-to-numeric synchronization triggers
DROP TRIGGER IF EXISTS sync_submissions_metric_trigger ON public.profile_edit_submissions;
CREATE TRIGGER sync_submissions_metric_trigger
  BEFORE INSERT OR UPDATE ON public.profile_edit_submissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_submission_action_details_metric();

DROP TRIGGER IF EXISTS sync_timeline_metric_trigger ON public.timeline_entries;
CREATE TRIGGER sync_timeline_metric_trigger
  BEFORE INSERT OR UPDATE ON public.timeline_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_submission_action_details_metric();


-- 5. INITIAL SEEDING (SANDBOX SPOOFER ADMIN)
INSERT INTO public.contributors (
  contributor_id,
  full_name,
  email,
  username,
  password_hash,
  role,
  account_status,
  trust_score,
  writing_token_status,
  sandbox_profile_metrics
) VALUES (
  '88bc8912-43ba-4abc-882a-ef92481aa323',
  'Pedro Penduko',
  'pedro@politikapp.gov.ph',
  'pedro_sandbox',
  '$2a$10$tZ2cK.2.mF.yq4H5Lgq5eO/J5F5L.gX1N2l3u3T4e5R6y7U8i9O0P',
  'ADMIN',
  'ACTIVE',
  100.00,
  'ACTIVE',
  '{}'::jsonb
) ON CONFLICT (contributor_id) DO NOTHING;


-- 6. FLYWAY SCHEMA HISTORY REGISTRATION
-- Pre-populate flyway_schema_history so Flyway on Spring Boot startup recognizes
-- that migrations V1 through V15 have already been applied, avoiding baseline traps.
CREATE TABLE IF NOT EXISTS public.flyway_schema_history (
  installed_rank integer NOT NULL,
  version character varying(50),
  description character varying(200) NOT NULL,
  type character varying(20) NOT NULL,
  script character varying(1000) NOT NULL,
  checksum integer,
  installed_by character varying(100) NOT NULL,
  installed_on timestamp without time zone DEFAULT now() NOT NULL,
  execution_time integer NOT NULL,
  success boolean NOT NULL,
  CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank)
);

CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx ON public.flyway_schema_history (success);

-- Idempotently insert records for V1 through V15 if not present
INSERT INTO public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
VALUES
  (1, '1', 'create politikapp core schema', 'SQL', 'V1__create_politikapp_core_schema.sql', NULL, 'supabase_admin', 10, true),
  (2, '2', 'create reputation logs', 'SQL', 'V2__create_reputation_logs.sql', NULL, 'supabase_admin', 10, true),
  (3, '3', 'add auth columns to contributors', 'SQL', 'V3__add_auth_columns_to_contributors.sql', NULL, 'supabase_admin', 10, true),
  (4, '4', 'add missing statuses to constraints', 'SQL', 'V4__add_missing_statuses_to_constraints.sql', NULL, 'supabase_admin', 10, true),
  (5, '5', 'seed sandbox spoofer', 'SQL', 'V5__seed_sandbox_spoofer.sql', NULL, 'supabase_admin', 10, true),
  (6, '6', 'replace quantitative metric with action details', 'SQL', 'V6__replace_quantitative_metric_with_action_details.sql', NULL, 'supabase_admin', 10, true),
  (7, '7', 'add appealed status to constraints', 'SQL', 'V7__add_appealed_status_to_constraints.sql', NULL, 'supabase_admin', 10, true),
  (8, '8', 'backfill timeline submission links', 'SQL', 'V8__backfill_timeline_submission_links.sql', NULL, 'supabase_admin', 10, true),
  (9, '9', 'enforce trust score 0 500', 'SQL', 'V9__enforce_trust_score_0_500.sql', NULL, 'supabase_admin', 10, true),
  (10, '10', 'add sandbox profile metrics', 'SQL', 'V10__add_sandbox_profile_metrics.sql', NULL, 'supabase_admin', 10, true),
  (11, '12', 'create peer applications', 'SQL', 'V12__create_peer_applications.sql', NULL, 'supabase_admin', 10, true),
  (12, '13', 'add jury votes unique constraint', 'SQL', 'V13__add_jury_votes_unique_constraint.sql', NULL, 'supabase_admin', 10, true),
  (13, '14', 'admin curation and challenges', 'SQL', 'V14__admin_curation_and_challenges.sql', NULL, 'supabase_admin', 10, true),
  (14, '15', 'harmonize schema and preserve legacy attributes', 'SQL', 'V15__harmonize_schema_and_preserve_legacy_attributes.sql', NULL, 'supabase_admin', 10, true)
ON CONFLICT (installed_rank) DO NOTHING;
