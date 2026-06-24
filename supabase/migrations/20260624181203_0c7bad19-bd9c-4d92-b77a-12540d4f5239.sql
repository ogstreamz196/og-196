ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_link_token text,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_token_key
  ON public.profiles (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;