
CREATE OR REPLACE FUNCTION public.daily_coin_floor()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
  r RECORD;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  FOR r IN
    SELECT id, coin_balance FROM public.profiles WHERE coin_balance < 10
  LOOP
    UPDATE public.profiles SET coin_balance = 10 WHERE id = r.id;
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (r.id, 10 - r.coin_balance, 'daily_floor',
              'daily_floor:from_' || r.coin_balance::text || '_to_10');
    affected := affected + 1;
  END LOOP;

  RETURN affected;
END;
$$;
