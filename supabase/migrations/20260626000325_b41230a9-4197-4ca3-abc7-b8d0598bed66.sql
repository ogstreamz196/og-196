
-- 1. Revoke anon EXECUTE on SECURITY DEFINER functions (all already require auth.uid())
REVOKE EXECUTE ON FUNCTION public.admin_referral_audit(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_referral_reconciliation(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_generation_capacity(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_referrer_permanent(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referrer() FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer_by_code(text) FROM anon;

-- 2. Scope community_messages reads: only recent (7d) plus your own messages
DROP POLICY IF EXISTS "Authenticated can read community" ON public.community_messages;
CREATE POLICY "Authenticated can read recent community"
  ON public.community_messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (user_id = auth.uid() OR created_at > now() - interval '7 days')
  );

-- 3. og_bot_remote_tokens: explicit admin-only write policies (defense in depth)
DROP POLICY IF EXISTS "Admins insert remote tokens" ON public.og_bot_remote_tokens;
DROP POLICY IF EXISTS "Admins update remote tokens" ON public.og_bot_remote_tokens;
DROP POLICY IF EXISTS "Admins delete remote tokens" ON public.og_bot_remote_tokens;

CREATE POLICY "Admins insert remote tokens"
  ON public.og_bot_remote_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update remote tokens"
  ON public.og_bot_remote_tokens
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete remote tokens"
  ON public.og_bot_remote_tokens
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
