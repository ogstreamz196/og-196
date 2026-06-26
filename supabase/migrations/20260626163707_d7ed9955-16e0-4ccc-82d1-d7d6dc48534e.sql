CREATE UNIQUE INDEX IF NOT EXISTS coin_tx_stripe_purchase_reference_unique
ON public.coin_transactions (reference)
WHERE type = 'stripe_purchase' AND reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_coin_transaction(
  _user_id uuid,
  _amount integer,
  _type text,
  _reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_tx_id uuid;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id_required';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  IF _type IS NULL OR length(trim(_type)) = 0 THEN
    RAISE EXCEPTION 'type_required';
  END IF;

  IF _reference IS NULL OR length(trim(_reference)) = 0 THEN
    RAISE EXCEPTION 'reference_required';
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
  VALUES (_user_id, _amount, _type, _reference)
  ON CONFLICT (reference) WHERE type = 'stripe_purchase' AND reference IS NOT NULL DO NOTHING
  RETURNING id INTO inserted_tx_id;

  IF inserted_tx_id IS NULL THEN
    SELECT coin_balance INTO new_balance
    FROM public.profiles
    WHERE id = _user_id;

    RETURN jsonb_build_object(
      'credited', false,
      'balance', COALESCE(new_balance, 0)
    );
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
  SET coin_balance = COALESCE(coin_balance, 0) + _amount
  WHERE id = _user_id
  RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    DELETE FROM public.coin_transactions WHERE id = inserted_tx_id;
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN jsonb_build_object(
    'credited', true,
    'balance', new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_coin_transaction(uuid, integer, text, text) FROM public;
REVOKE ALL ON FUNCTION public.credit_coin_transaction(uuid, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_coin_transaction(uuid, integer, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coin_transaction(uuid, integer, text, text) TO service_role;