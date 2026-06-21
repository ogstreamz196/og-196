
CREATE OR REPLACE FUNCTION public.set_dev_admin(target_user_id uuid, make_dev boolean, admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;
  IF make_dev THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, 'dev')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'dev_grant',
              'admin_grant_dev' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN true;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'dev';
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'dev_revoke',
              'admin_revoke_dev' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_boss_admin(target_user_id uuid, make_boss boolean, admin_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;
  IF make_boss THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, 'boss')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'boss_grant',
              'admin_grant_boss' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN true;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'boss';
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'boss_revoke',
              'admin_revoke_boss' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN false;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_dev_admin(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_boss_admin(uuid, boolean, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_dev_admin(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_boss_admin(uuid, boolean, text) TO authenticated;
