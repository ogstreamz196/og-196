-- Add new app_role value for OG Bot access
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'og_bot';

-- Admin RPC to grant/revoke OG Bot access (mirrors set_vip_admin)
CREATE OR REPLACE FUNCTION public.set_og_bot_admin(
  target_user_id uuid,
  make_og boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot'
  ) INTO exists_already;

  IF make_og THEN
    IF exists_already THEN RETURN true; END IF;
    INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, 'og_bot')
      ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'og_bot_grant',
              'admin_grant_og_bot' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN true;
  ELSE
    IF NOT exists_already THEN RETURN false; END IF;
    DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot';
    INSERT INTO public.coin_transactions(user_id, amount, type, reference)
      VALUES (target_user_id, 0, 'og_bot_revoke',
              'admin_revoke_og_bot' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    RETURN false;
  END IF;
END;
$function$;