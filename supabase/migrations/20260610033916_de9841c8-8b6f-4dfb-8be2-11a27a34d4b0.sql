
CREATE TABLE public.boss_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  category text NOT NULL,
  target_key text NOT NULL,
  old_value text,
  new_value text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX boss_audit_log_created_idx ON public.boss_audit_log(created_at DESC);
CREATE INDEX boss_audit_log_category_idx ON public.boss_audit_log(category, created_at DESC);

GRANT SELECT ON public.boss_audit_log TO authenticated;
GRANT ALL ON public.boss_audit_log TO service_role;

ALTER TABLE public.boss_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.boss_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update set_site_content to record before/after into audit log
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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

-- Audit trigger for app_settings (settings category)
CREATE OR REPLACE FUNCTION public.audit_app_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.has_role(actor, 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.boss_audit_log(actor_id, action, category, target_key, old_value, new_value)
      VALUES (actor, 'update', 'settings', NEW.key, OLD.value::text, NEW.value::text);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.boss_audit_log(actor_id, action, category, target_key, old_value, new_value)
      VALUES (actor, 'create', 'settings', NEW.key, NULL, NEW.value::text);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.boss_audit_log(actor_id, action, category, target_key, old_value, new_value)
      VALUES (actor, 'delete', 'settings', OLD.key, OLD.value::text, NULL);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_app_settings_iud ON public.app_settings;
CREATE TRIGGER audit_app_settings_iud
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_app_settings_change();
