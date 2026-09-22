DROP TRIGGER audit_coin_deduction_trg ON public.profiles;

ALTER TABLE public.profiles
  ALTER COLUMN coin_balance TYPE numeric(12,2) USING coin_balance::numeric;

CREATE TRIGGER audit_coin_deduction_trg
AFTER UPDATE OF coin_balance ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_coin_deduction();

ALTER TABLE public.coin_transactions
  ALTER COLUMN amount TYPE numeric(12,2) USING amount::numeric;

ALTER TABLE public.battle_tallies
  ALTER COLUMN total_awarded_coins TYPE numeric(12,2)
  USING total_awarded_coins::numeric;

CREATE OR REPLACE FUNCTION public.payout_battle_reward(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tally public.battle_tallies%ROWTYPE;
  reward numeric(12,2);
  new_balance numeric(12,2);
BEGIN
  SELECT * INTO tally
  FROM public.battle_tallies
  WHERE user_id = _user_id
  FOR UPDATE;

  IF tally.user_id IS NULL OR tally.pending_tenths <= 0 THEN
    RETURN jsonb_build_object('coins', 0, 'balance', NULL);
  END IF;

  reward := tally.pending_tenths::numeric / 10;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
  VALUES (_user_id, reward, 'battle_reward', 'battle:' || gen_random_uuid()::text);

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles
  SET coin_balance = coin_balance + reward
  WHERE id = _user_id
  RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.battle_tallies
  SET pending_tenths = 0,
      rounds = 0,
      total_awarded_coins = total_awarded_coins + reward,
      updated_at = now()
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('coins', reward, 'balance', new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.payout_battle_reward(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payout_battle_reward(uuid) TO service_role;