
-- 1. Referrals table
CREATE TABLE public.referrals (
  referee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referee_id <> referrer_id)
);
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE POLICY "Admins see all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Claim referral (called by the new signed-in user shortly after sign-up)
CREATE OR REPLACE FUNCTION public.claim_referral(p_referrer uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_created timestamptz;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_referrer IS NULL OR p_referrer = caller THEN RETURN false; END IF;

  -- Caller must be a real profile and < 24h old
  SELECT created_at INTO caller_created FROM public.profiles WHERE id = caller;
  IF caller_created IS NULL THEN RETURN false; END IF;
  IF caller_created < now() - interval '24 hours' THEN RETURN false; END IF;

  -- Referrer must exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_referrer) THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals(referee_id, referrer_id)
    VALUES (caller, p_referrer)
    ON CONFLICT (referee_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

-- 3. Update deduct_coins to credit 10% cashback to the referrer
CREATE OR REPLACE FUNCTION public.deduct_coins(p_user uuid, p_amount integer, p_reference text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
  ref_id uuid;
  cashback integer;
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

  -- 10% cashback to referrer (floor, only if >= 1 coin)
  SELECT referrer_id INTO ref_id FROM public.referrals WHERE referee_id = p_user;
  IF ref_id IS NOT NULL THEN
    cashback := p_amount / 10;  -- integer division = floor
    IF cashback >= 1 THEN
      UPDATE public.profiles
        SET coin_balance = coin_balance + cashback
        WHERE id = ref_id;
      INSERT INTO public.coin_transactions(user_id, amount, type, reference)
        VALUES (ref_id, cashback, 'referral_cashback',
                'referee:' || p_user::text || '|burn:' || p_amount::text || '|ref:' || COALESCE(p_reference, ''));
    END IF;
  END IF;

  RETURN new_balance;
END;
$$;

-- 4. Summary RPC for dashboard
CREATE OR REPLACE FUNCTION public.get_referral_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  total_refs integer;
  total_earned integer;
  recent jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT COUNT(*) INTO total_refs FROM public.referrals WHERE referrer_id = caller;
  SELECT COALESCE(SUM(amount), 0) INTO total_earned
    FROM public.coin_transactions
    WHERE user_id = caller AND type = 'referral_cashback';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'amount', amount, 'reference', reference, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO recent
  FROM (
    SELECT id, amount, reference, created_at
    FROM public.coin_transactions
    WHERE user_id = caller AND type = 'referral_cashback'
    ORDER BY created_at DESC
    LIMIT 20
  ) sub;

  RETURN jsonb_build_object(
    'total_referred', total_refs,
    'total_earned', total_earned,
    'recent', recent
  );
END;
$$;
