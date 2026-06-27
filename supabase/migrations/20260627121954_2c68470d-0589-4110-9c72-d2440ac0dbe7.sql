
CREATE TABLE IF NOT EXISTS public.og_lexicon (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase text NOT NULL UNIQUE,
  severity smallint NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No anon, no authenticated. Only service_role (used via SECURITY DEFINER fns).
GRANT ALL ON public.og_lexicon TO service_role;

ALTER TABLE public.og_lexicon ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lexicon_admin_select" ON public.og_lexicon FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));
CREATE POLICY "lexicon_admin_write" ON public.og_lexicon FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss'));

DROP TRIGGER IF EXISTS og_lexicon_updated_at ON public.og_lexicon;
CREATE TRIGGER og_lexicon_updated_at BEFORE UPDATE ON public.og_lexicon
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Boss/admin-only RPCs (SECURITY DEFINER so the table itself stays unreachable).
CREATE OR REPLACE FUNCTION public.admin_list_lexicon()
RETURNS SETOF public.og_lexicon
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.og_lexicon ORDER BY severity DESC, phrase ASC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_lexicon_phrase(
  p_phrase text, p_severity smallint DEFAULT 1, p_enabled boolean DEFAULT true, p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  clean text := lower(btrim(p_phrase));
  rid uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF clean IS NULL OR length(clean) < 2 OR length(clean) > 60 THEN
    RAISE EXCEPTION 'invalid_phrase';
  END IF;
  INSERT INTO public.og_lexicon(phrase, severity, enabled, notes, created_by)
    VALUES (clean, COALESCE(p_severity, 1), COALESCE(p_enabled, true), NULLIF(btrim(p_notes), ''), auth.uid())
    ON CONFLICT (phrase) DO UPDATE
      SET severity = EXCLUDED.severity,
          enabled = EXCLUDED.enabled,
          notes = EXCLUDED.notes,
          updated_at = now()
    RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_lexicon_phrase(p_phrase text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'boss')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.og_lexicon WHERE phrase = lower(btrim(p_phrase));
  RETURN FOUND;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_list_lexicon() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_lexicon_phrase(text, smallint, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_lexicon_phrase(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_list_lexicon() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_lexicon_phrase(text, smallint, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_lexicon_phrase(text) TO authenticated;
