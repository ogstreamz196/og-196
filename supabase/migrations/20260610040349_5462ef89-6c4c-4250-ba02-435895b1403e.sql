
ALTER TABLE public.og_bot_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_og_bot_token_expiry(
  target_user_id uuid,
  new_expires_at timestamptz,
  admin_notes text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_expires timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.og_bot_tokens WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  SELECT expires_at INTO old_expires FROM public.og_bot_tokens WHERE user_id = target_user_id;

  UPDATE public.og_bot_tokens
    SET expires_at = new_expires_at,
        updated_at = now()
    WHERE user_id = target_user_id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'og_bot_token_expiry',
            'expiry:' || COALESCE(old_expires::text, '∅') || '→' || COALESCE(new_expires_at::text, '∅')
            || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));

  RETURN new_expires_at;
END;
$$;
