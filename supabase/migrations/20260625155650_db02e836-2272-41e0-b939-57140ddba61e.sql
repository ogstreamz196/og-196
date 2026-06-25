
CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT,
  kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_processed_updates TO service_role;

ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_processed_updates"
  ON public.telegram_processed_updates
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_telegram_processed_updates_created_at
  ON public.telegram_processed_updates (created_at DESC);
