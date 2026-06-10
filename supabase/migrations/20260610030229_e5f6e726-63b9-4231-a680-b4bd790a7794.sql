ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER TABLE public.songs REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;