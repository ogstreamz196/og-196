
CREATE OR REPLACE FUNCTION public.prevent_self_coin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (edge functions / admin) and the postgres role to update freely.
  IF current_setting('request.jwt.claim.role', true) IN ('service_role') THEN
    RETURN NEW;
  END IF;
  -- For everyone else: silently keep coin_balance unchanged.
  IF NEW.coin_balance IS DISTINCT FROM OLD.coin_balance THEN
    NEW.coin_balance := OLD.coin_balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_coin_balance ON public.profiles;
CREATE TRIGGER profiles_protect_coin_balance
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_coin_change();
