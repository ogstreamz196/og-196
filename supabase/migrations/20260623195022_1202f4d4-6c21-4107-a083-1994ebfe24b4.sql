
-- Extend the authenticated-readable allowlist to include the new free_access_all key.
DROP POLICY IF EXISTS "Authenticated read public settings" ON public.app_settings;
CREATE POLICY "Authenticated read public settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (
    key IN (
      'coins_per_generation',
      'coins_per_lyrics_generation',
      'coins_per_full_unlock',
      'coins_per_variation_divisor',
      'songs_per_generation',
      'sample_seconds',
      'signup_credits',
      'free_access_all'
    )
  );

-- Let devs (not just admins) toggle the free-access flag from the dev dashboard.
DROP POLICY IF EXISTS "Devs manage free_access_all update" ON public.app_settings;
CREATE POLICY "Devs manage free_access_all update"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'free_access_all' AND public.has_role(auth.uid(), 'dev'))
  WITH CHECK (key = 'free_access_all' AND public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage free_access_all insert" ON public.app_settings;
CREATE POLICY "Devs manage free_access_all insert"
  ON public.app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (key = 'free_access_all' AND public.has_role(auth.uid(), 'dev'));

-- Seed the flag ON for the limited-time promo.
INSERT INTO public.app_settings(key, value)
  VALUES ('free_access_all', to_jsonb(true))
  ON CONFLICT (key) DO NOTHING;
