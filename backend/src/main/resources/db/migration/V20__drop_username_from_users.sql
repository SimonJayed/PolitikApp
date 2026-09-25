UPDATE public.users
SET email = 'admin@politikapp.com'
WHERE LOWER(username) = 'admin'
  AND LOWER(email) <> 'admin@politikapp.com';

ALTER TABLE public.users
  DROP COLUMN IF EXISTS username;