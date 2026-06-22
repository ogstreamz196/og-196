
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyrics_progress smallint,
  ADD COLUMN IF NOT EXISTS lyrics_stage text,
  ADD COLUMN IF NOT EXISTS lyrics_started_at timestamptz;
