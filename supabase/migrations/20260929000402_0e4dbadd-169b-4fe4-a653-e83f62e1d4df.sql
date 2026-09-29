REVOKE EXECUTE ON FUNCTION public.boss_get_online_users(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_get_online_users(integer) TO service_role;