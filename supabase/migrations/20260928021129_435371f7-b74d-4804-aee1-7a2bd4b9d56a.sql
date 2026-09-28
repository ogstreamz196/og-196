CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, coin_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    0
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_welcome_bonus(_user_id uuid, _eligible boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric(12,2);
BEGIN
  IF NOT COALESCE(_eligible, false) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'device_limit');
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = _user_id AND type = 'bonus' AND reference = 'welcome'
  ) THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
  VALUES (_user_id, 25, 'bonus', 'welcome');

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles
  SET coin_balance = coin_balance + 25
  WHERE id = _user_id
  RETURNING coin_balance INTO new_balance;

  RETURN jsonb_build_object('granted', true, 'balance', new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_welcome_bonus(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_welcome_bonus(uuid, boolean) TO service_role;