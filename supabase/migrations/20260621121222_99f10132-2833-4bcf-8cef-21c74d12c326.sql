CREATE OR REPLACE FUNCTION public.set_site_content(p_key text, p_value text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  trimmed_key text := btrim(p_key);
  trimmed_val text := p_value;
  prev_val text;
  cat text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev')) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF trimmed_key IS NULL OR length(trimmed_key) = 0 OR length(trimmed_key) > 200 THEN
    RAISE EXCEPTION 'invalid_key';
  END IF;
  IF trimmed_val IS NULL OR length(trimmed_val) > 5000 THEN
    RAISE EXCEPTION 'invalid_value';
  END IF;

  SELECT value INTO prev_val FROM public.site_content WHERE key = trimmed_key;

  INSERT INTO public.site_content(key, value, updated_by)
    VALUES (trimmed_key, trimmed_val, auth.uid())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();

  IF prev_val IS DISTINCT FROM trimmed_val THEN
    cat := CASE
      WHEN trimmed_key LIKE 'og_persona.%' THEN 'persona'
      WHEN trimmed_key LIKE 'buyCoins.pack.%' THEN 'store'
      ELSE 'copy'
    END;
    INSERT INTO public.boss_audit_log(actor_id, action, category, target_key, old_value, new_value)
      VALUES (auth.uid(),
              CASE WHEN prev_val IS NULL THEN 'create' ELSE 'update' END,
              cat, trimmed_key, prev_val, trimmed_val);
  END IF;

  RETURN trimmed_val;
END;
$function$;