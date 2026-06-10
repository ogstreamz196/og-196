-- ===== Table for OG Bot tokens =====
CREATE TABLE IF NOT EXISTS public.og_bot_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

GRANT SELECT ON public.og_bot_tokens TO authenticated;
GRANT ALL ON public.og_bot_tokens TO service_role;

ALTER TABLE public.og_bot_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all OG bot tokens" ON public.og_bot_tokens;
CREATE POLICY "Admins can read all OG bot tokens"
  ON public.og_bot_tokens
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read their own OG bot token" ON public.og_bot_tokens;
CREATE POLICY "Users can read their own OG bot token"
  ON public.og_bot_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_og_bot_tokens_updated_at ON public.og_bot_tokens;
CREATE TRIGGER set_og_bot_tokens_updated_at
  BEFORE UPDATE ON public.og_bot_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Token generator using two uuids for ~256 bits of entropy
CREATE OR REPLACE FUNCTION public.gen_og_bot_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $function$
  SELECT 'ogb_' || replace(gen_random_uuid()::text, '-', '')
                || replace(gen_random_uuid()::text, '-', '');
$function$;

CREATE OR REPLACE FUNCTION public.set_og_bot_admin(
  target_user_id uuid,
  make_og boolean,
  admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  exists_already boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot'
  ) INTO exists_already;

  IF make_og THEN
    IF NOT exists_already THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (target_user_id, 'og_bot')
        ON CONFLICT (user_id, role) DO NOTHING;
      INSERT INTO public.coin_transactions(user_id, amount, type, reference)
        VALUES (target_user_id, 0, 'og_bot_grant',
                'admin_grant_og_bot' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    END IF;
    INSERT INTO public.og_bot_tokens(user_id, token)
      VALUES (target_user_id, public.gen_og_bot_token())
      ON CONFLICT (user_id) DO NOTHING;
    RETURN true;
  ELSE
    IF exists_already THEN
      DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot';
      INSERT INTO public.coin_transactions(user_id, amount, type, reference)
        VALUES (target_user_id, 0, 'og_bot_revoke',
                'admin_revoke_og_bot' || COALESCE(' | ' || NULLIF(btrim(admin_notes), ''), ''));
    END IF;
    DELETE FROM public.og_bot_tokens WHERE user_id = target_user_id;
    RETURN false;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.regenerate_og_bot_token(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role = 'og_bot') THEN
    RAISE EXCEPTION 'not_og_bot';
  END IF;

  new_token := public.gen_og_bot_token();

  INSERT INTO public.og_bot_tokens(user_id, token)
    VALUES (target_user_id, new_token)
    ON CONFLICT (user_id) DO UPDATE
      SET token = EXCLUDED.token, updated_at = now(), last_used_at = NULL;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (target_user_id, 0, 'og_bot_token_rotate', 'admin_rotate_og_bot_token');

  RETURN new_token;
END;
$function$;

-- Backfill tokens for existing og_bot users
INSERT INTO public.og_bot_tokens(user_id, token)
SELECT ur.user_id, public.gen_og_bot_token()
FROM public.user_roles ur
WHERE ur.role = 'og_bot'
ON CONFLICT (user_id) DO NOTHING;