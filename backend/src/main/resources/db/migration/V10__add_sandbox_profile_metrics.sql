ALTER TABLE public.contributors
  ADD COLUMN IF NOT EXISTS sandbox_profile_metrics jsonb NOT NULL DEFAULT '{}'::jsonb;
