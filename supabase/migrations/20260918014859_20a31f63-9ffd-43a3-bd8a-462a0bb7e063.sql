ALTER TABLE public.user_preferences
  DROP CONSTRAINT IF EXISTS user_preferences_foul_intensity_range;

UPDATE public.user_preferences
SET foul_intensity = CASE
  WHEN foul_intensity <= 1 THEN 1
  WHEN foul_intensity <= 3 THEN 2
  ELSE 3
END;

ALTER TABLE public.user_preferences
  ALTER COLUMN foul_intensity SET DEFAULT 3;

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_foul_intensity_range
  CHECK (foul_intensity BETWEEN 0 AND 3);