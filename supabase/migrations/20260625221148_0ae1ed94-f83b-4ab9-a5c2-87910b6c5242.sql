ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyric_video_preview_path text,
  ADD COLUMN IF NOT EXISTS lyric_video_full_path text,
  ADD COLUMN IF NOT EXISTS lyric_video_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS lyric_video_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lyric_video_rendered_at timestamptz,
  ADD COLUMN IF NOT EXISTS lyric_video_error text;

INSERT INTO public.app_settings(key, value)
  VALUES ('coins_per_lyric_video', '5'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- Idempotency: at most one successful video unlock charge per song
CREATE UNIQUE INDEX IF NOT EXISTS coin_tx_lyric_video_unique
  ON public.coin_transactions (reference)
  WHERE type = 'lyric_video_unlock';