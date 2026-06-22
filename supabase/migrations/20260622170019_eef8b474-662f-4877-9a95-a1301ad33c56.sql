CREATE OR REPLACE FUNCTION public.refund_generation_charge(p_user uuid, p_amount integer, p_reference text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'missing_user';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = coin_balance + p_amount
    WHERE id = p_user
    RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (p_user, p_amount, 'refund', p_reference);

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_generation_charge(uuid, integer, text) TO service_role;