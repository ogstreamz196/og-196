
INSERT INTO public.app_settings(key, value)
  VALUES ('signup_credits', '5'::jsonb)
  ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  starter integer;
BEGIN
  SELECT COALESCE((value)::int, 5) INTO starter
    FROM public.app_settings WHERE key = 'signup_credits';
  IF starter IS NULL OR starter < 0 THEN starter := 5; END IF;

  INSERT INTO public.profiles (id, email, display_name, coin_balance)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), starter);

  IF starter > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, type, reference)
    VALUES (NEW.id, starter, 'bonus', 'welcome');
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN lower(NEW.email) = 'ogstreamz196@gmail.com' THEN 'admin'::public.app_role
         ELSE 'user'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
