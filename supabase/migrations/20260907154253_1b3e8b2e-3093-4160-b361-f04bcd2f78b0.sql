ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS drive_audio_id text,
  ADD COLUMN IF NOT EXISTS drive_audio_link text,
  ADD COLUMN IF NOT EXISTS drive_lyrics_id text,
  ADD COLUMN IF NOT EXISTS drive_lyrics_link text,
  ADD COLUMN IF NOT EXISTS drive_archived_at timestamptz;