-- 1. profiles denormalized snapshot
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_path text,
  ADD COLUMN IF NOT EXISTS last_label text;

CREATE INDEX IF NOT EXISTS idx_profiles_last_activity_at
  ON public.profiles (last_activity_at DESC);

-- 2. activity log (full audit trail)
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT 'nav',
  path text,
  label text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;
GRANT ALL ON public.user_activity_log TO service_role;

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_insert_self"
  ON public.user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_select_self_or_admin"
  ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'boss'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created
  ON public.user_activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_created
  ON public.user_activity_log (created_at DESC);

-- 3. RPC used by client heartbeat + nav tracker: writes both log row and
-- denormalized snapshot, bypassing the profile balance-guard trigger safely
-- (we only touch activity columns).
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action text,
  p_path text,
  p_label text,
  p_metadata jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  clean_action text := COALESCE(NULLIF(btrim(p_action), ''), 'nav');
  clean_path text := NULLIF(btrim(p_path), '');
  clean_label text := NULLIF(btrim(p_label), '');
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF clean_path IS NOT NULL AND length(clean_path) > 400 THEN
    clean_path := substr(clean_path, 1, 400);
  END IF;
  IF clean_label IS NOT NULL AND length(clean_label) > 120 THEN
    clean_label := substr(clean_label, 1, 120);
  END IF;

  -- Skip pure heartbeat spam from the log; still refresh snapshot
  IF clean_action <> 'heartbeat' THEN
    INSERT INTO public.user_activity_log(user_id, action, path, label, metadata)
      VALUES (caller, clean_action, clean_path, clean_label, p_metadata);
  END IF;

  UPDATE public.profiles
    SET last_activity_at = now(),
        last_path = COALESCE(clean_path, last_path),
        last_label = COALESCE(clean_label, last_label)
    WHERE id = caller;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_activity(text, text, text, jsonb)
  TO authenticated;

-- 4. RPC used by the Telegram bot (via service role) for boss commands
CREATE OR REPLACE FUNCTION public.boss_get_online_users(p_minutes int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  last_activity_at timestamptz,
  last_path text,
  last_label text,
  coin_balance int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, display_name, email, last_activity_at, last_path, last_label, coin_balance
  FROM public.profiles
  WHERE last_activity_at IS NOT NULL
    AND last_activity_at > now() - make_interval(mins => GREATEST(1, LEAST(1440, p_minutes)))
  ORDER BY last_activity_at DESC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION public.boss_get_online_users(int)
  TO authenticated, service_role;