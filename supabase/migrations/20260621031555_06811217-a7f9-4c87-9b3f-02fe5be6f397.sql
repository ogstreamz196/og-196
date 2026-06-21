
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.app_settings FROM anon;
