ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz;

UPDATE public.songs
SET generation_started_at = COALESCE(generation_started_at, updated_at, created_at)
WHERE status IN ('pending', 'processing')
  AND generation_started_at IS NULL;