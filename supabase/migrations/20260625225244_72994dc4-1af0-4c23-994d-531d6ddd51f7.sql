CREATE UNIQUE INDEX IF NOT EXISTS songs_suno_clip_id_unique
  ON public.songs (suno_clip_id)
  WHERE suno_clip_id IS NOT NULL;