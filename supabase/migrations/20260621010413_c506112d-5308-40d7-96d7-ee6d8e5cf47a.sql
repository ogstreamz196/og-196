INSERT INTO public.app_settings(key, value)
VALUES ('coins_per_lyrics_generation', '1'::jsonb)
ON CONFLICT (key) DO NOTHING;