
-- 1. Add 'vip' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vip';

-- Commit enum change before functions reference it
COMMIT;
BEGIN;

-- 2. Admin grant / revoke VIP
CREATE OR REPLACE FUNCTION public.set_vip_admin(target_user_id uuid, make_vip boolean, admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  exists_already boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'vip'
  ) INTO exists_already;

  IF make_vip THEN
    IF exists_already THEN RETURN true; END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, 'vip')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'vip_grant',
              'admin_grant_vip' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN true;
  ELSE
    IF NOT exists_already THEN RETURN false; END IF;
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'vip';
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'vip_revoke',
              'admin_revoke_vip' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN false;
  END IF;
END;
$$;

-- 3. User self-purchase: 20 coins → VIP role (atomic)
CREATE OR REPLACE FUNCTION public.purchase_vip()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  cost   integer := 20;
  new_balance integer;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = caller AND role = 'vip') THEN
    RAISE EXCEPTION 'already_vip';
  END IF;

  -- Bypass self-balance-protect trigger for this txn
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = coin_balance - cost
    WHERE id = caller AND coin_balance >= cost
    RETURNING coin_balance INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  INSERT INTO public.user_roles(user_id, role) VALUES (caller, 'vip')
    ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (caller, -cost, 'vip_purchase', 'self_purchase_vip');

  RETURN new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_vip_admin(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_vip() TO authenticated;
