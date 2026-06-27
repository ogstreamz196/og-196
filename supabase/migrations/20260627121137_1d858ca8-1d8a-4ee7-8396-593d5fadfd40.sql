
-- 1. Audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('coin_deduction','song_unlocked')),
  target_user_id uuid,
  actor_id uuid,
  song_id uuid,
  coin_delta integer,
  old_balance integer,
  new_balance integer,
  reason text,
  jwt_role text,
  request_ip text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_audit_log_target_idx ON public.security_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_event_idx  ON public.security_audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_log_song_idx   ON public.security_audit_log(song_id, created_at DESC);

GRANT SELECT ON public.security_audit_log TO authenticated;
GRANT ALL    ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins read everything; nothing else can read, update or delete (immutable from app).
CREATE POLICY "Admins read audit log"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Coin-deduction trigger on profiles
CREATE OR REPLACE FUNCTION public.audit_coin_deduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  delta integer;
BEGIN
  IF NEW.coin_balance IS NULL OR OLD.coin_balance IS NULL THEN
    RETURN NEW;
  END IF;
  delta := NEW.coin_balance - OLD.coin_balance;
  IF delta < 0 THEN
    INSERT INTO public.security_audit_log
      (event_type, target_user_id, actor_id, coin_delta, old_balance, new_balance, jwt_role, reason)
    VALUES
      ('coin_deduction', NEW.id, auth.uid(), delta, OLD.coin_balance, NEW.coin_balance,
       current_setting('request.jwt.claim.role', true),
       current_setting('lov.audit_reason', true));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_coin_deduction_trg ON public.profiles;
CREATE TRIGGER audit_coin_deduction_trg
  AFTER UPDATE OF coin_balance ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_coin_deduction();

-- 3. Song-unlock trigger
CREATE OR REPLACE FUNCTION public.audit_song_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.unlocked, false) = true
     AND COALESCE(OLD.unlocked, false) = false THEN
    INSERT INTO public.security_audit_log
      (event_type, target_user_id, actor_id, song_id, jwt_role, reason)
    VALUES
      ('song_unlocked', NEW.user_id, auth.uid(), NEW.id,
       current_setting('request.jwt.claim.role', true),
       current_setting('lov.audit_reason', true));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_song_unlock_trg ON public.songs;
CREATE TRIGGER audit_song_unlock_trg
  AFTER UPDATE OF unlocked ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.audit_song_unlock();
