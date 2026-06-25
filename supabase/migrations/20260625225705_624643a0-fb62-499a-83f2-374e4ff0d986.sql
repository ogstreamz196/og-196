CREATE OR REPLACE FUNCTION public.claim_referrer_permanent(p_referrer uuid, p_acknowledged boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  existing uuid;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_acknowledged IS NOT TRUE THEN RAISE EXCEPTION 'acknowledgement_required'; END IF;
  IF p_referrer IS NULL OR p_referrer = caller THEN RAISE EXCEPTION 'invalid_referrer'; END IF;

  SELECT referrer_id INTO existing FROM public.referrals WHERE referee_id = caller;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'already_has_referrer';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_referrer) THEN
    RAISE EXCEPTION 'referrer_not_found';
  END IF;

  INSERT INTO public.referrals(referee_id, referrer_id)
    VALUES (caller, p_referrer);

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (caller, 0, 'referral_bind', 'permanent_bind_to:' || p_referrer::text);

  RETURN jsonb_build_object('ok', true, 'referrer_id', p_referrer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referrer_permanent(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_referrer()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  ref RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT r.referrer_id, COALESCE(p.display_name, split_part(p.email,'@',1), 'Unknown') AS name
    INTO ref
    FROM public.referrals r
    LEFT JOIN public.profiles p ON p.id = r.referrer_id
    WHERE r.referee_id = caller;
  IF ref.referrer_id IS NULL THEN
    RETURN jsonb_build_object('has_referrer', false);
  END IF;
  RETURN jsonb_build_object('has_referrer', true, 'referrer_id', ref.referrer_id, 'referrer_name', ref.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referrer() TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_referrer(p_referrer uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  nm text;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT COALESCE(display_name, split_part(email,'@',1), 'Unknown') INTO nm
    FROM public.profiles WHERE id = p_referrer;
  IF nm IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'referrer_id', p_referrer, 'referrer_name', nm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_referrer(uuid) TO authenticated;