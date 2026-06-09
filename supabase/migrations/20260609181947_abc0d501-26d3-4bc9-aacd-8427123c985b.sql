
-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  coin_balance INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SONGS
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  style TEXT,
  lyrics TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  suno_task_id TEXT,
  suno_clip_id TEXT,
  audio_path TEXT,
  cover_url TEXT,
  duration_seconds NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own songs" ON public.songs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own songs" ON public.songs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_songs_user_created ON public.songs(user_id, created_at DESC);
CREATE INDEX idx_songs_suno_task ON public.songs(suno_task_id);

-- COIN TRANSACTIONS
CREATE TABLE public.coin_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'purchase', 'generation', 'refund', 'bonus'
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_tx_user_created ON public.coin_transactions(user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_songs_updated BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + welcome coins on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, coin_balance)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 10);
  INSERT INTO public.coin_transactions (user_id, amount, type, reference)
  VALUES (NEW.id, 10, 'bonus', 'welcome');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic coin deduction helper used by edge functions
CREATE OR REPLACE FUNCTION public.deduct_coins(p_user UUID, p_amount INT, p_reference TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE public.profiles
    SET coin_balance = coin_balance - p_amount
    WHERE id = p_user AND coin_balance >= p_amount
    RETURNING coin_balance INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;
  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (p_user, -p_amount, 'generation', p_reference);
  RETURN new_balance;
END; $$;

-- Realtime for songs (so UI can react when generation completes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
