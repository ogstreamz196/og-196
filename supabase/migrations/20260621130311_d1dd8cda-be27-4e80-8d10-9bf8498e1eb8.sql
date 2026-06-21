CREATE TABLE public.telegram_dm_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  telegram_message_id bigint,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tdq_target ON public.telegram_dm_queue(target_user_id, created_at DESC);
CREATE INDEX idx_tdq_status ON public.telegram_dm_queue(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_dm_queue TO authenticated;
GRANT ALL ON public.telegram_dm_queue TO service_role;

ALTER TABLE public.telegram_dm_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view DM queue" ON public.telegram_dm_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert DM queue" ON public.telegram_dm_queue
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update DM queue" ON public.telegram_dm_queue
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tdq_updated_at BEFORE UPDATE ON public.telegram_dm_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();