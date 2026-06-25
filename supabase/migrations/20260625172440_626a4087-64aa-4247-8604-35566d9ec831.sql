
INSERT INTO public.app_settings(key, value) VALUES
  ('max_concurrent_jobs_global', '10'::jsonb),
  ('max_concurrent_jobs_per_user', '2'::jsonb),
  ('peak_mode_per_user', '1'::jsonb),
  ('peak_mode_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enforce only on charges recorded from this migration forward (skip legacy dupes).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_generation_charge_per_song
  ON public.coin_transactions(user_id, reference)
  WHERE type = 'generation'
    AND reference IS NOT NULL
    AND created_at >= '2026-06-25 17:25:00+00'
    AND reference ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

CREATE OR REPLACE FUNCTION public.deduct_coins(p_user uuid, p_amount integer, p_reference text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance integer;
  ref_id uuid;
  cashback integer;
  existing_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user THEN
    RAISE EXCEPTION 'forbidden_self_only';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount_must_be_positive';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- Idempotency only for song-id references (UUID-shaped). Repeats return current balance.
  IF p_reference IS NOT NULL AND p_reference ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    -- Serialize concurrent charges for this user.
    PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;

    SELECT COUNT(*) INTO existing_count
      FROM public.coin_transactions
      WHERE user_id = p_user AND reference = p_reference AND type = 'generation';
    IF existing_count > 0 THEN
      SELECT coin_balance INTO new_balance FROM public.profiles WHERE id = p_user;
      RETURN new_balance;
    END IF;
  END IF;

  UPDATE public.profiles
    SET coin_balance = coin_balance - p_amount
    WHERE id = p_user AND coin_balance >= p_amount
    RETURNING coin_balance INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  BEGIN
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (p_user, -p_amount, 'generation', p_reference);
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.profiles SET coin_balance = coin_balance + p_amount WHERE id = p_user
      RETURNING coin_balance INTO new_balance;
    RETURN new_balance;
  END;

  SELECT referrer_id INTO ref_id FROM public.referrals WHERE referee_id = p_user;
  IF ref_id IS NOT NULL THEN
    cashback := p_amount / 10;
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
$function$;

CREATE OR REPLACE FUNCTION public.check_generation_capacity(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  global_cap int;
  user_cap int;
  peak_cap int;
  peak_on boolean;
  global_active int;
  user_active int;
  effective_user_cap int;
BEGIN
  SELECT COALESCE((value)::int, 10) INTO global_cap FROM public.app_settings WHERE key = 'max_concurrent_jobs_global';
  SELECT COALESCE((value)::int, 2) INTO user_cap FROM public.app_settings WHERE key = 'max_concurrent_jobs_per_user';
  SELECT COALESCE((value)::int, 1) INTO peak_cap FROM public.app_settings WHERE key = 'peak_mode_per_user';
  SELECT COALESCE((value)::boolean, false) INTO peak_on FROM public.app_settings WHERE key = 'peak_mode_enabled';

  global_cap := COALESCE(global_cap, 10);
  user_cap := COALESCE(user_cap, 2);
  peak_cap := COALESCE(peak_cap, 1);
  effective_user_cap := CASE WHEN peak_on THEN peak_cap ELSE user_cap END;

  SELECT COUNT(*) INTO global_active FROM public.songs
    WHERE status IN ('pending', 'processing', 'queued');
  SELECT COUNT(*) INTO user_active FROM public.songs
    WHERE user_id = p_user AND status IN ('pending', 'processing', 'queued');

  IF global_active >= global_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'global_capacity_full',
      'global_active', global_active, 'user_active', user_active,
      'global_cap', global_cap, 'user_cap', effective_user_cap, 'peak', peak_on);
  END IF;
  IF user_active >= effective_user_cap THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_capacity_full',
      'global_active', global_active, 'user_active', user_active,
      'global_cap', global_cap, 'user_cap', effective_user_cap, 'peak', peak_on);
  END IF;

  RETURN jsonb_build_object('ok', true,
    'global_active', global_active, 'user_active', user_active,
    'global_cap', global_cap, 'user_cap', effective_user_cap, 'peak', peak_on);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_generation_capacity(uuid) TO authenticated, service_role;
