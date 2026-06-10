
-- Admins can view all coin transactions (audit)
DROP POLICY IF EXISTS "Admins view all transactions" ON public.coin_transactions;
CREATE POLICY "Admins view all transactions" ON public.coin_transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Set absolute balance, logging the delta
CREATE OR REPLACE FUNCTION public.set_balance_admin(target_user_id uuid, new_balance integer, admin_notes text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  old_balance integer;
  delta integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF new_balance IS NULL OR new_balance < 0 OR new_balance > 100000000 THEN
    RAISE EXCEPTION 'balance_out_of_range';
  END IF;

  SELECT coin_balance INTO old_balance FROM public.profiles WHERE id = target_user_id;
  IF old_balance IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  delta := new_balance - old_balance;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles SET coin_balance = new_balance WHERE id = target_user_id;

  IF delta <> 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, delta,
              CASE WHEN delta > 0 THEN 'admin_mint' ELSE 'admin_deduct' END,
              COALESCE(NULLIF(admin_notes, ''), 'admin_set_balance'));
  END IF;

  RETURN new_balance;
END;
$$;

-- Update display_name (label) and log to the audit history
CREATE OR REPLACE FUNCTION public.admin_update_profile_label(target_user_id uuid, new_display_name text, admin_notes text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  old_name text;
  trimmed text := NULLIF(btrim(new_display_name), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF trimmed IS NULL OR length(trimmed) > 80 THEN
    RAISE EXCEPTION 'invalid_display_name';
  END IF;

  SELECT display_name INTO old_name FROM public.profiles WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  IF old_name IS NOT DISTINCT FROM trimmed THEN
    RETURN trimmed;
  END IF;

  UPDATE public.profiles SET display_name = trimmed WHERE id = target_user_id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'admin_label',
            'label:' || COALESCE(old_name, '∅') || '→' || trimmed
            || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));

  RETURN trimmed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_balance_admin(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile_label(uuid, text, text) TO authenticated;
