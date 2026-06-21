CREATE OR REPLACE FUNCTION public.og_learn_insult(p_user_id uuid, p_phrase text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text := lower(btrim(p_phrase));
BEGIN
  IF clean IS NULL OR length(clean) < 3 OR length(clean) > 60 THEN
    RETURN;
  END IF;
  INSERT INTO public.og_learned_insults(user_id, phrase, uses, last_seen_at)
    VALUES (p_user_id, clean, 1, now())
    ON CONFLICT (user_id, phrase) DO UPDATE
      SET uses = public.og_learned_insults.uses + 1,
          last_seen_at = now();
END;
$$;

-- Only the service role (called from the chat server function) should invoke this.
REVOKE ALL ON FUNCTION public.og_learn_insult(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.og_learn_insult(uuid, text) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.og_learn_insult(uuid, text) TO service_role;