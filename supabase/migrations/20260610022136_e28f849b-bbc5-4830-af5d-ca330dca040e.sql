-- Tighten site_content writes: only the security-definer set_site_content RPC may write.
-- Public can still read (for SSR/landing); admins drive content through the RPC,
-- which already checks has_role(auth.uid(),'admin').
REVOKE INSERT, UPDATE, DELETE ON public.site_content FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_content FROM anon;
GRANT  SELECT ON public.site_content TO anon, authenticated;
GRANT  ALL    ON public.site_content TO service_role;

-- Make the existing admin-write RLS policies explicit/idempotent.
DROP POLICY IF EXISTS "Admins can insert site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can update site content" ON public.site_content;
DROP POLICY IF EXISTS "Admins can delete site content" ON public.site_content;

CREATE POLICY "Only boss can insert site content"
  ON public.site_content FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only boss can update site content"
  ON public.site_content FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only boss can delete site content"
  ON public.site_content FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
