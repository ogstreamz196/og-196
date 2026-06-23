
CREATE TABLE public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_refund_id text NOT NULL UNIQUE,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  stripe_session_id text,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  failure_reason text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_refunds_user_id ON public.payment_refunds(user_id);
CREATE INDEX idx_payment_refunds_session ON public.payment_refunds(stripe_session_id);

GRANT SELECT ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own refunds"
  ON public.payment_refunds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages refunds"
  ON public.payment_refunds FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_payment_refunds_updated_at
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
