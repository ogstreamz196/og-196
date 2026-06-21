CREATE TABLE public.og_learned_insults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phrase text not null,
  uses integer not null default 0,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, phrase)
);

CREATE INDEX og_learned_insults_user_idx ON public.og_learned_insults(user_id, last_seen_at DESC);

GRANT SELECT, DELETE ON public.og_learned_insults TO authenticated;
GRANT ALL ON public.og_learned_insults TO service_role;

ALTER TABLE public.og_learned_insults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own learned insults"
  ON public.og_learned_insults FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own learned insults"
  ON public.og_learned_insults FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);