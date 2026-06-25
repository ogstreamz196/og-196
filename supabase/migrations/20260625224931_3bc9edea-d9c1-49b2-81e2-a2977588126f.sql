ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyric_video_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lyric_video_stage text;
ALTER TABLE public.songs REPLICA IDENTITY FULL;