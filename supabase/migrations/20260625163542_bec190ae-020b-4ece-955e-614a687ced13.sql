
-- =========================================================
-- Sign-in telemetry, devices, boss notification prefs
-- =========================================================

-- 1) sign_in_events ---------------------------------------
CREATE TABLE public.sign_in_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip text,
  country text,
  region text,
  city text,
  lat double precision,
  lng double precision,
  gps_lat double precision,
  gps_lng double precision,
  ua_raw text,
  browser text,
  os text,
  device_type text,
  referrer text,
  landing_path text,
  is_new_device boolean NOT NULL DEFAULT false,
  is_new_country boolean NOT NULL DEFAULT false,
  is_signup boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sign_in_events_user ON public.sign_in_events(user_id, created_at DESC);
CREATE INDEX idx_sign_in_events_created ON public.sign_in_events(created_at DESC);

GRANT SELECT, INSERT ON public.sign_in_events TO authenticated;
GRANT ALL ON public.sign_in_events TO service_role;

ALTER TABLE public.sign_in_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own sign_in_events"
  ON public.sign_in_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admin or boss read all sign_in_events"
  ON public.sign_in_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE POLICY "users insert own sign_in_events"
  ON public.sign_in_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2) user_devices -----------------------------------------
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ua_hash text NOT NULL,
  ip_subnet text,
  browser text,
  os text,
  device_type text,
  first_country text,
  last_country text,
  sign_in_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ua_hash)
);
CREATE INDEX idx_user_devices_user ON public.user_devices(user_id, last_seen_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own devices"
  ON public.user_devices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admin or boss read all devices"
  ON public.user_devices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'));

CREATE POLICY "users upsert own devices"
  ON public.user_devices FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own devices"
  ON public.user_devices FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 3) boss_notification_prefs ------------------------------
CREATE TABLE public.boss_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_on_signup boolean NOT NULL DEFAULT true,
  notify_every_signin boolean NOT NULL DEFAULT false,
  notify_new_device boolean NOT NULL DEFAULT true,
  notify_new_country boolean NOT NULL DEFAULT true,
  notify_suspicious boolean NOT NULL DEFAULT true,
  sheets_sync_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.boss_notification_prefs TO authenticated;
GRANT ALL ON public.boss_notification_prefs TO service_role;

ALTER TABLE public.boss_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin or boss read own prefs"
  ON public.boss_notification_prefs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'))
  );

CREATE POLICY "admin or boss upsert own prefs"
  ON public.boss_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'))
  );

CREATE POLICY "admin or boss update own prefs"
  ON public.boss_notification_prefs FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'boss'))
  );

-- 4) profiles denorm fields -------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS last_country text,
  ADD COLUMN IF NOT EXISTS last_city text,
  ADD COLUMN IF NOT EXISTS last_device text,
  ADD COLUMN IF NOT EXISTS sign_in_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gps_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gps_consent_at timestamptz;
