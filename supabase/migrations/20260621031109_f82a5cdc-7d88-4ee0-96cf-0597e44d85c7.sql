
REVOKE EXECUTE ON FUNCTION public.dev_override_balance(uuid, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.boss_burn_coins(uuid, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.boss_reclaim_coins(uuid, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_override_balance(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_burn_coins(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_reclaim_coins(uuid, integer, text) TO authenticated;
