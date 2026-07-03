REVOKE EXECUTE ON FUNCTION public.boss_get_online_users(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_user_activity(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boss_get_online_users(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_activity(text, text, text, jsonb) TO authenticated;