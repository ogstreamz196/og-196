ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS foul_mouth boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foul_intensity smallint NOT NULL DEFAULT 0;

ALTER TABLE public.songs
  DROP CONSTRAINT IF EXISTS songs_foul_intensity_check;

ALTER TABLE public.songs
  ADD CONSTRAINT songs_foul_intensity_check
  CHECK (foul_intensity BETWEEN 0 AND 3);