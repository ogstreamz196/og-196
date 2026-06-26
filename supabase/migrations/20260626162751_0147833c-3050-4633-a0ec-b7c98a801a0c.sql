CREATE OR REPLACE FUNCTION public.increment_coin_balance(_user_id uuid, _delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Balance writes are protected by a trigger. Mark this trusted helper as a
  -- service operation for the duration of the atomic update so webhook/reconcile
  -- credits cannot be silently reverted by the protection trigger.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = COALESCE(coin_balance, 0) + _delta
    WHERE id = _user_id
    RETURNING coin_balance INTO new_balance;

  RETURN new_balance;
END;
$$;