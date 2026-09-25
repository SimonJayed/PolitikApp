DO $$
DECLARE
  retained_admin uuid;
BEGIN
  SELECT contributor_id
  INTO retained_admin
  FROM public.contributors
  ORDER BY
    CASE
      WHEN UPPER(COALESCE(role, '')) IN ('ADMIN', 'ADMINISTRATOR') THEN 0
      WHEN LOWER(COALESCE(username, '')) = 'admin'
        OR LOWER(email) = 'admin@politikapp.com' THEN 1
      ELSE 2
    END,
    created_at NULLS LAST,
    contributor_id
  LIMIT 1;

  IF retained_admin IS NOT NULL THEN
    DELETE FROM public.profile_edit_submissions
    WHERE contributor_id <> retained_admin;

    IF to_regclass('public.reputation_audit_logs') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.reputation_audit_logs WHERE peer_id <> $1'
      USING retained_admin;
    END IF;

    IF to_regclass('public.jury_votes') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.jury_votes WHERE peer_id <> $1'
      USING retained_admin;
    END IF;

    DELETE FROM public.contributors
    WHERE contributor_id <> retained_admin;

    UPDATE public.contributors
    SET username = 'admin'
    WHERE contributor_id = retained_admin;
  END IF;
END $$;

ALTER TABLE public.contributors
  DROP CONSTRAINT IF EXISTS contributors_role_check,
  DROP CONSTRAINT IF EXISTS contributors_account_status_check,
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS account_status;

ALTER TABLE public.contributors RENAME TO users;