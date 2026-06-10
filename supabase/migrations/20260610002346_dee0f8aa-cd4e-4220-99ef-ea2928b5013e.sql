
-- Hardened self-balance protection: anything that isn't service_role gets blocked.
CREATE OR REPLACE FUNCTION public.prevent_self_coin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Only service_role (edge functions w/ service key) may change balances directly.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.coin_balance IS DISTINCT FROM OLD.coin_balance THEN
    NEW.coin_balance := OLD.coin_balance;
  END IF;
  RETURN NEW;
END;
$$;

-- Admin-only mint/award/deduct function. SECURITY DEFINER so the trigger sees service_role-equivalent path,
-- but we still gate on has_role(auth.uid(), 'admin').
CREATE OR REPLACE FUNCTION public.mint_coins(
  p_target uuid,
  p_amount integer,
  p_reason text DEFAULT 'admin_mint'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF p_amount > 100000 OR p_amount < -100000 THEN
    RAISE EXCEPTION 'amount_out_of_range';
  END IF;

  -- Bypass the self-protect trigger by setting a service_role-marker for this txn.
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
$$;

REVOKE ALL ON FUNCTION public.mint_coins(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mint_coins(uuid, integer, text) TO authenticated;

-- Lock down deduct_coins so only the caller can deduct from themselves (defense in depth).
CREATE OR REPLACE FUNCTION public.deduct_coins(p_user uuid, p_amount integer, p_reference text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user THEN
    RAISE EXCEPTION 'forbidden_self_only';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = coin_balance - p_amount
    WHERE id = p_user AND coin_balance >= p_amount
    RETURNING coin_balance INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;
  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (p_user, -p_amount, 'generation', p_reference);
  RETURN new_balance;
END;
$$;
