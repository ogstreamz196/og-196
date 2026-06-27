REVOKE EXECUTE ON FUNCTION public.list_community_songs(integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_community_songs(integer, integer) TO authenticated, service_role;