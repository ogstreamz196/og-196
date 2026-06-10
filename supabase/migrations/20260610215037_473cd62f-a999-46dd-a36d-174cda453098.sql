
ALTER TABLE public.og_bot_tokens
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.revoke_og_bot_token(target_user_id uuid, admin_notes text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts timestamptz := now();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.og_bot_tokens WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  UPDATE public.og_bot_tokens
    SET revoked_at = ts, updated_at = now()
    WHERE user_id = target_user_id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'og_bot_token_revoke',
            'admin_revoke_og_bot_token' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));

  RETURN ts;
END;
$$;

CREATE OR REPLACE FUNCTION public.unrevoke_og_bot_token(target_user_id uuid, admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.og_bot_tokens WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  UPDATE public.og_bot_tokens
    SET revoked_at = NULL, updated_at = now()
    WHERE user_id = target_user_id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'og_bot_token_unrevoke',
            'admin_unrevoke_og_bot_token' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_og_bot_token(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot') THEN
    RAISE EXCEPTION 'not_og_bot';
  END IF;

  new_token := public.gen_og_bot_token();

  INSERT INTO public.og_bot_tokens(user_id, token)
    VALUES (target_user_id, new_token)
    ON CONFLICT (user_id) DO UPDATE
      SET token = EXCLUDED.token,
          updated_at = now(),
          last_used_at = NULL,
          revoked_at = NULL;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'og_bot_token_rotate', 'admin_rotate_og_bot_token');

  RETURN new_token;
END;
$$;
