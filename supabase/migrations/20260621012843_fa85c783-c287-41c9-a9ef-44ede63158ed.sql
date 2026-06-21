
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS is_variation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revealed boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS songs_task_variation_idx
  ON public.songs (suno_task_id, is_variation);

INSERT INTO public.app_settings(key, value)
  VALUES ('coins_per_variation_divisor', to_jsonb(2))
  ON CONFLICT (key) DO NOTHING;
