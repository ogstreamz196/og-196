REVOKE EXECUTE ON FUNCTION public.admin_referral_audit(integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.check_generation_capacity(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_referrer_permanent(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_referrer() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer_by_code(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_referral_audit(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_generation_capacity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_referrer_permanent(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referrer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_referrer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_referrer_by_code(text) TO authenticated;