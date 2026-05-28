ALTER TABLE public.contributors DROP CONSTRAINT IF EXISTS contributors_trust_score_range_check;

UPDATE public.contributors
SET trust_score = LEAST(500.00, GREATEST(0.00, COALESCE(trust_score, 100.00)));

ALTER TABLE public.contributors
  ALTER COLUMN trust_score SET DEFAULT 100.00,
  ALTER COLUMN trust_score SET NOT NULL;

ALTER TABLE public.contributors ADD CONSTRAINT contributors_trust_score_range_check
  CHECK (trust_score >= 0.00 AND trust_score <= 500.00);
