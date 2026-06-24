CREATE TABLE public.user_onboarding_checks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  ok boolean NOT NULL,
  detail text,
  latency_ms integer,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_onboarding_checks TO authenticated;
GRANT ALL ON public.user_onboarding_checks TO service_role;

ALTER TABLE public.user_onboarding_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own onboarding checks"
  ON public.user_onboarding_checks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users write own onboarding checks"
  ON public.user_onboarding_checks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own onboarding checks"
  ON public.user_onboarding_checks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own onboarding checks"
  ON public.user_onboarding_checks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);