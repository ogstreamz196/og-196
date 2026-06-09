
CREATE TABLE public.portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  language text NOT NULL,
  style_tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portals TO anon, authenticated;
GRANT ALL ON public.portals TO service_role;

ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone views portals" ON public.portals
  FOR SELECT USING (true);
CREATE POLICY "Admins insert portals" ON public.portals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update portals" ON public.portals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete portals" ON public.portals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER portals_updated_at
  BEFORE UPDATE ON public.portals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.songs ADD COLUMN portal_id uuid REFERENCES public.portals(id) ON DELETE SET NULL;
CREATE INDEX songs_portal_id_idx ON public.songs (portal_id);
