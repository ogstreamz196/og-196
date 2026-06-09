
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS unlocked boolean NOT NULL DEFAULT false;

CREATE POLICY "Admins view all songs" ON public.songs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all songs" ON public.songs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
