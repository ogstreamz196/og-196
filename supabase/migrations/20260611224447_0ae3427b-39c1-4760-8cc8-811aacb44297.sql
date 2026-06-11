ALTER TABLE public.bot_tokens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_tokens;