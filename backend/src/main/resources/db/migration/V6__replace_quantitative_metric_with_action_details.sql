-- V6__replace_quantitative_metric_with_action_details.sql

-- 1. Add action_details jsonb column as nullable
ALTER TABLE public.profile_edit_submissions ADD COLUMN action_details jsonb;
ALTER TABLE public.timeline_entries ADD COLUMN action_details jsonb;

-- 2. Populate new action_details column using dynamic values from quantitative_metric
UPDATE public.profile_edit_submissions
SET action_details = 
  CASE 
    WHEN action_identifier = 'BUDGET_ALLOCATION' THEN jsonb_build_object('allocationAmount', quantitative_metric)
    WHEN action_identifier = 'COA_FINDING' THEN jsonb_build_object('flaggedAmount', quantitative_metric)
    ELSE jsonb_build_object('metric', quantitative_metric)
  END;

UPDATE public.timeline_entries
SET action_details = 
  CASE 
    WHEN action_identifier = 'BUDGET_ALLOCATION' THEN jsonb_build_object('allocationAmount', quantitative_metric)
    WHEN action_identifier = 'COA_FINDING' THEN jsonb_build_object('flaggedAmount', quantitative_metric)
    ELSE jsonb_build_object('metric', quantitative_metric)
  END;

-- 3. Drop legacy quantitative_metric columns
ALTER TABLE public.profile_edit_submissions DROP COLUMN quantitative_metric;
ALTER TABLE public.timeline_entries DROP COLUMN quantitative_metric;

-- 4. Create Generalized Inverted Indexes (GIN) on the new action_details column to optimize performance
CREATE INDEX idx_submissions_action_details_jsonb ON public.profile_edit_submissions USING gin (action_details);
CREATE INDEX idx_timeline_entries_action_details_jsonb ON public.timeline_entries USING gin (action_details);
