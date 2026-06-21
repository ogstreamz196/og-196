
-- 1. app_settings: restrict authenticated reads to a known allowlist of safe keys; admins keep full read.
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

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
      'signup_credits'
    )
  );

CREATE POLICY "Admins read all settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. portals: scope public read to active portals; admins see all statuses.
DROP POLICY IF EXISTS "Portals are viewable by everyone" ON public.portals;
DROP POLICY IF EXISTS "Anyone can view portals" ON public.portals;
DROP POLICY IF EXISTS "Public can view portals" ON public.portals;
DROP POLICY IF EXISTS "Public read portals" ON public.portals;

CREATE POLICY "Public read active portals"
  ON public.portals
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "Admins read all portals"
  ON public.portals
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. og_bot_token_invites: let the creator or the redeemer read their own row.
CREATE POLICY "Users read own invites"
  ON public.og_bot_token_invites
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid() OR redeemed_by = auth.uid());
