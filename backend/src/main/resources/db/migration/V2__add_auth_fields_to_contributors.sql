ALTER TABLE public.contributors 
ADD COLUMN IF NOT EXISTS username VARCHAR(80),
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

ALTER TABLE public.contributors
ADD CONSTRAINT contributors_username_unique UNIQUE (username);
