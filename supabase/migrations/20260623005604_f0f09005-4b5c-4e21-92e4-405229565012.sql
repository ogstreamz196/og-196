REVOKE EXECUTE ON FUNCTION public.dev_send_og_message_as_bot(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_send_og_message_as_bot(uuid, text) TO authenticated;