CREATE TABLE public.telegram_sign_in_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id bigint,
  telegram_username text,
  telegram_first_name text,
  event_kind text NOT NULL DEFAULT 'link',
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tg_signin_user ON public.telegram_sign_in_events (user_id, created_at DESC);
CREATE INDEX idx_tg_signin_created ON public.telegram_sign_in_events (created_at DESC);

GRANT SELECT ON public.telegram_sign_in_events TO authenticated;
GRANT ALL ON public.telegram_sign_in_events TO service_role;

ALTER TABLE public.telegram_sign_in_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boss or admin read all telegram_sign_in_events"
  ON public.telegram_sign_in_events FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'boss'::app_role)
  );

CREATE POLICY "users read own telegram_sign_in_events"
  ON public.telegram_sign_in_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());