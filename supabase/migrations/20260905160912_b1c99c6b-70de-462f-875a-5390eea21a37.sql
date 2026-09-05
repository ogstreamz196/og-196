CREATE TABLE public.battle_tallies (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pending_tenths integer NOT NULL DEFAULT 0,
  rounds integer NOT NULL DEFAULT 0,
  total_awarded_coins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.battle_tallies TO authenticated;
GRANT ALL ON public.battle_tallies TO service_role;
ALTER TABLE public.battle_tallies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own battle tally"
  ON public.battle_tallies FOR SELECT TO authenticated
  USING (auth.uid() = user_id);