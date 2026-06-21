ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_key
  ON public.profiles(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;