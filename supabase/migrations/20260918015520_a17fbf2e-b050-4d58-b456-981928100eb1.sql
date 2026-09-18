CREATE UNIQUE INDEX IF NOT EXISTS coin_tx_referral_payment_reference_unique
ON public.coin_transactions (reference)
WHERE type = 'referral_payment' AND reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_payment_referral(
  _referee_id uuid,
  _reward_coins integer,
  _payment_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id_value uuid;
  inserted_tx_id uuid;
  new_balance integer;
  reward_reference text;
BEGIN
  IF _referee_id IS NULL THEN
    RAISE EXCEPTION 'referee_id_required';
  END IF;
  IF _reward_coins <= 0 THEN
    RAISE EXCEPTION 'reward_must_be_positive';
  END IF;
  IF _payment_reference IS NULL OR length(trim(_payment_reference)) = 0 THEN
    RAISE EXCEPTION 'payment_reference_required';
  END IF;

  SELECT referrer_id INTO referrer_id_value
  FROM public.referrals
  WHERE referee_id = _referee_id;

  IF referrer_id_value IS NULL THEN
    RETURN jsonb_build_object('credited', false, 'reason', 'no_referrer');
  END IF;

  reward_reference := 'payment:referee:' || _referee_id::text || '|ref:' || trim(_payment_reference);

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
  VALUES (referrer_id_value, _reward_coins, 'referral_payment', reward_reference)
  ON CONFLICT (reference) WHERE type = 'referral_payment' AND reference IS NOT NULL DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    SELECT coin_balance INTO new_balance FROM public.profiles WHERE id = referrer_id_value;
    RETURN jsonb_build_object(
      'credited', false,
      'reason', 'already_credited',
      'referrer_id', referrer_id_value,
      'balance', COALESCE(new_balance, 0)
    );
  END IF;

  UPDATE public.profiles
  SET coin_balance = COALESCE(coin_balance, 0) + _reward_coins
  WHERE id = referrer_id_value
  RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    DELETE FROM public.coin_transactions WHERE id = inserted_tx_id;
    RAISE EXCEPTION 'referrer_profile_not_found';
  END IF;

  RETURN jsonb_build_object(
    'credited', true,
    'referrer_id', referrer_id_value,
    'reward_coins', _reward_coins,
    'balance', new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_payment_referral(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_payment_referral(uuid, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_payment_referral(uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_payment_referral(uuid, integer, text) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'coin_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_transactions;
  END IF;
END
$$;