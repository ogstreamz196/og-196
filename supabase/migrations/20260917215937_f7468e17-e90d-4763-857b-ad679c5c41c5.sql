ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS foul_intensity smallint NOT NULL DEFAULT 3;

ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_foul_intensity_range;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_foul_intensity_range
  CHECK (foul_intensity BETWEEN 1 AND 5);