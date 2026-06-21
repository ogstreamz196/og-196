
-- 1. site_content: tighten public read to og_persona.* allowlist only
DROP POLICY IF EXISTS "Public can read non-persona site content" ON public.site_content;
DROP POLICY IF EXISTS "Public reads og_persona content" ON public.site_content;
CREATE POLICY "Public reads og_persona content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (key LIKE 'og_persona.%');

-- 2. portals: drop overly-broad public-read policy
DROP POLICY IF EXISTS "Anyone views portals" ON public.portals;

-- 3. og_learned_insults: add owner INSERT/UPDATE policies
CREATE POLICY "Users insert their own learned insults"
  ON public.og_learned_insults FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own learned insults"
  ON public.og_learned_insults FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Revoke anon EXECUTE on auth-required SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.claim_referral(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_referral_summary() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_referral(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_summary() TO authenticated;
