
CREATE OR REPLACE FUNCTION public.mint_coins_admin(target_user_id uuid, amount integer, admin_notes text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF amount IS NULL OR amount = 0 THEN
    RAISE EXCEPTION 'amount_must_be_nonzero';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = GREATEST(0, coin_balance + amount)
    WHERE id = target_user_id
    RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, amount, 'admin_mint', COALESCE(NULLIF(admin_notes, ''), 'admin_mint'));

  RETURN new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mint_coins(p_target uuid, p_amount integer, p_reason text DEFAULT 'admin_mint'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance integer;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.has_role(caller, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount_must_be_nonzero';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = GREATEST(0, coin_balance + p_amount)
    WHERE id = p_target
    RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (p_target, p_amount,
            CASE WHEN p_amount > 0 THEN 'mint' ELSE 'admin_deduct' END,
            COALESCE(p_reason, 'admin_mint'));

  RETURN new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_balance_admin(target_user_id uuid, new_balance integer, admin_notes text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_balance integer;
  delta integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
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
      VALUES (target_user_id, delta,
              CASE WHEN delta > 0 THEN 'admin_mint' ELSE 'admin_deduct' END,
              COALESCE(NULLIF(admin_notes, ''), 'admin_set_balance'));
  END IF;

  RETURN new_balance;
END;
$function$;
