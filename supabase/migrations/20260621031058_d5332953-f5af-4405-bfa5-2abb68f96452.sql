
-- DEV: manually override any balance to an exact value
CREATE OR REPLACE FUNCTION public.dev_override_balance(target_user_id uuid, new_balance integer, dev_notes text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_balance integer;
  delta integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'dev') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: dev role required';
  END IF;
  IF new_balance IS NULL OR new_balance < 0 THEN
    RAISE EXCEPTION 'balance_out_of_range';
  END IF;

  SELECT coin_balance INTO old_balance FROM public.profiles WHERE id = target_user_id;
  IF old_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  delta := new_balance - old_balance;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles SET coin_balance = new_balance WHERE id = target_user_id;

  IF delta <> 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, delta, 'dev_override',
              'dev_override' || COALESCE(' | ' || NULLIF(btrim(dev_notes), ''), ''));
  END IF;

  RETURN new_balance;
END;
$$;

-- BOSS: burn (permanently destroy) coins from a user
CREATE OR REPLACE FUNCTION public.boss_burn_coins(target_user_id uuid, amount integer, boss_notes text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: boss role required';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = GREATEST(0, coin_balance - amount)
    WHERE id = target_user_id
    RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, -amount, 'boss_burn',
            'boss_burn' || COALESCE(' | ' || NULLIF(btrim(boss_notes), ''), ''));

  RETURN new_balance;
END;
$$;

-- BOSS: reclaim coins from a user back to the boss caller
CREATE OR REPLACE FUNCTION public.boss_reclaim_coins(target_user_id uuid, amount integer, boss_notes text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target_new_balance integer;
  boss_new_balance integer;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT (public.has_role(caller, 'boss') OR public.has_role(caller, 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: boss role required';
  END IF;
  IF amount IS NULL OR amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;
  IF target_user_id = caller THEN
    RAISE EXCEPTION 'cannot_reclaim_from_self';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = coin_balance - amount
    WHERE id = target_user_id AND coin_balance >= amount
    RETURNING coin_balance INTO target_new_balance;

  IF target_new_balance IS NULL THEN
    -- distinguish between not_found vs insufficient
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
      RAISE EXCEPTION 'target_not_found';
    END IF;
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE public.profiles
    SET coin_balance = coin_balance + amount
    WHERE id = caller
    RETURNING coin_balance INTO boss_new_balance;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, -amount, 'boss_reclaim',
            'boss_reclaim_to:' || caller::text || COALESCE(' | ' || NULLIF(btrim(boss_notes), ''), ''));
  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (caller, amount, 'boss_reclaim_credit',
            'boss_reclaim_from:' || target_user_id::text || COALESCE(' | ' || NULLIF(btrim(boss_notes), ''), ''));

  RETURN target_new_balance;
END;
$$;
