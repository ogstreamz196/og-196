UPDATE public.app_settings SET value = '0'::jsonb WHERE key IN ('coins_per_generation', 'coins_per_lyrics_generation');
UPDATE public.app_settings SET value = '5'::jsonb WHERE key = 'coins_per_full_unlock';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, coin_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    25
  );
  INSERT INTO public.coin_transactions (user_id, amount, type, reference)
  VALUES (NEW.id, 25, 'bonus', 'welcome');
  RETURN NEW;
END;
$$;