
-- 1. Restrict og_persona.* keys in site_content to admins
DROP POLICY IF EXISTS "Anyone can read site content" ON public.site_content;

CREATE POLICY "Public can read non-persona site content"
  ON public.site_content FOR SELECT
  TO public
  USING (key NOT LIKE 'og_persona.%');

CREATE POLICY "Admins can read all site content"
  ON public.site_content FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Explicit admin-only SELECT policy on og_bot_remote_tokens
CREATE POLICY "Admins can view remote tokens"
  ON public.og_bot_remote_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Remove bot_tokens from realtime publication (token_string would broadcast)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bot_tokens'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.bot_tokens';
  END IF;
END $$;

-- 4. Revoke anon EXECUTE on SECURITY DEFINER functions that require auth
REVOKE EXECUTE ON FUNCTION public.create_og_bot_invite(timestamp with time zone, timestamp with time zone, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_bot_interactions(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_og_bot_remote_tokens_safe() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.purchase_bot_token(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.redeem_og_bot_invite(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_og_bot_invite(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_og_bot_token(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.unrevoke_og_bot_token(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_bot_token(text, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.create_og_bot_invite(timestamp with time zone, timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_bot_interactions(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_og_bot_remote_tokens_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_bot_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_og_bot_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_og_bot_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_og_bot_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unrevoke_og_bot_token(uuid, text) TO authenticated;
-- validate_bot_token is called by edge/server code only:
GRANT EXECUTE ON FUNCTION public.validate_bot_token(text, text) TO service_role;
