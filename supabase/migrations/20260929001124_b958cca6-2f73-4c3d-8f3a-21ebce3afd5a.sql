CREATE OR REPLACE FUNCTION public.prevent_self_coin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
  claims_role text;
BEGIN
  BEGIN
    claims_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  EXCEPTION WHEN others THEN
    claims_role := NULL;
  END;
  -- Only trusted server code (service role) may change balances directly.
  IF jwt_role = 'service_role' OR claims_role = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.coin_balance IS DISTINCT FROM OLD.coin_balance THEN
    NEW.coin_balance := OLD.coin_balance;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.prevent_self_coin_change() FROM PUBLIC, anon, authenticated;