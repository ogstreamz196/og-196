
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

  WITH rows AS (
    SELECT t.id, t.amount, t.reference, t.created_at,
           -- pull referee_id from the reference column "referee:<uuid>|burn:N|ref:..."
           NULLIF(split_part(split_part(t.reference, '|', 1), ':', 2), '')::uuid AS referee_id
    FROM public.coin_transactions t
    WHERE t.user_id = caller AND t.type = 'referral_cashback'
    ORDER BY t.created_at DESC
    LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'amount', r.amount,
    'reference', r.reference,
    'created_at', r.created_at,
    'referee_id', r.referee_id,
    'referee_name', COALESCE(p.display_name, split_part(p.email, '@', 1), 'Referred user')
  )), '[]'::jsonb)
  INTO recent
  FROM rows r
  LEFT JOIN public.profiles p ON p.id = r.referee_id;

  RETURN jsonb_build_object(
    'total_referred', total_refs,
    'total_earned', total_earned,
    'recent', recent
  );
END;
$$;
