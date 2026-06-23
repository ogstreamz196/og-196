
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_page text,
  ADD COLUMN IF NOT EXISTS last_page_at timestamptz;
