
CREATE OR REPLACE FUNCTION public.mint_coins_admin(
  target_user_id uuid,
  amount integer,
  admin_notes text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF amount IS NULL OR amount = 0 THEN
    RAISE EXCEPTION 'amount_must_be_nonzero';
  END IF;
  IF amount > 1000000 OR amount < -1000000 THEN
    RAISE EXCEPTION 'amount_out_of_range';
  END IF;

  -- Bypass the self-balance-protect trigger for this transaction only.
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
$$;

REVOKE ALL ON FUNCTION public.mint_coins_admin(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mint_coins_admin(uuid, integer, text) TO authenticated;
