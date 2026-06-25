CREATE OR REPLACE FUNCTION public.admin_referral_audit(p_limit int DEFAULT 100, p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  q text := NULLIF(btrim(p_search), '');
  users_json jsonb;
  ledger_json jsonb;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(caller, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH base AS (
    SELECT p.id, p.email, p.display_name, p.referral_code, p.coin_balance, p.created_at,
           r.referrer_id AS bound_referrer_id,
           r.created_at  AS bound_at,
           rp.display_name AS bound_referrer_name,
           rp.email AS bound_referrer_email,
           rp.referral_code AS bound_referrer_code,
           (SELECT COUNT(*) FROM public.referrals x WHERE x.referrer_id = p.id) AS invitees,
           COALESCE((SELECT SUM(t.amount) FROM public.coin_transactions t
                       WHERE t.user_id = p.id AND t.type = 'referral_cashback'), 0) AS earned
      FROM public.profiles p
      LEFT JOIN public.referrals r ON r.referee_id = p.id
      LEFT JOIN public.profiles rp ON rp.id = r.referrer_id
     WHERE q IS NULL
        OR p.email ILIKE '%'||q||'%'
        OR p.display_name ILIKE '%'||q||'%'
        OR p.referral_code ILIKE '%'||q||'%'
     ORDER BY p.created_at DESC
     LIMIT GREATEST(1, LEAST(p_limit, 500))
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(base)), '[]'::jsonb) INTO users_json FROM base;

  WITH rows AS (
    SELECT t.id, t.user_id, t.amount, t.reference, t.created_at,
           NULLIF(split_part(split_part(t.reference,'|',1),':',2),'')::uuid AS referee_id,
           COALESCE(rp.display_name, split_part(rp.email,'@',1)) AS referrer_name,
           COALESCE(pp.display_name, split_part(pp.email,'@',1)) AS referee_name
      FROM public.coin_transactions t
      LEFT JOIN public.profiles rp ON rp.id = t.user_id
      LEFT JOIN public.profiles pp ON pp.id = NULLIF(split_part(split_part(t.reference,'|',1),':',2),'')::uuid
     WHERE t.type = 'referral_cashback'
     ORDER BY t.created_at DESC
     LIMIT 100
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(rows)), '[]'::jsonb) INTO ledger_json FROM rows;

  RETURN jsonb_build_object('users', users_json, 'ledger', ledger_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_referral_audit(int, text) TO authenticated;