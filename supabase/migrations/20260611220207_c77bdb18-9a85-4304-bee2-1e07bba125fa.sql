
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS widget_deployed_domains text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS custom_bot_name text NOT NULL DEFAULT 'OG Bot',
  ADD COLUMN IF NOT EXISTS total_bot_interactions integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_custom_bot_name_len_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_custom_bot_name_len_chk
  CHECK (char_length(custom_bot_name) BETWEEN 1 AND 60);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_total_bot_interactions_nonneg_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_total_bot_interactions_nonneg_chk
  CHECK (total_bot_interactions >= 0);

CREATE OR REPLACE FUNCTION public.increment_bot_interactions(p_delta integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  new_count integer;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > 100 THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  UPDATE public.profiles
    SET total_bot_interactions = total_bot_interactions + p_delta
    WHERE id = caller
    RETURNING total_bot_interactions INTO new_count;

  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_bot_interactions(integer) TO authenticated;
