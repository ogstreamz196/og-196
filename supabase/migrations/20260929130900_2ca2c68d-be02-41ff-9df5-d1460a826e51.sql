CREATE TABLE public.daily_drops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drop_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  coins integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, drop_date)
);

GRANT SELECT ON public.daily_drops TO authenticated;
GRANT ALL ON public.daily_drops TO service_role;

ALTER TABLE public.daily_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily drops"
ON public.daily_drops FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER daily_drops_set_updated_at
BEFORE UPDATE ON public.daily_drops
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_daily_drop()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'utc')::date;
  reward integer;
  new_balance integer;
  inserted_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  reward := 1 + floor(random() * 3)::int; -- 1..3 coins

  INSERT INTO public.daily_drops(user_id, drop_date, coins)
  VALUES (uid, today, reward)
  ON CONFLICT (user_id, drop_date) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT coin_balance INTO new_balance FROM public.profiles WHERE id = uid;
    RETURN jsonb_build_object(
      'claimed', false,
      'coins', 0,
      'balance', COALESCE(new_balance, 0),
      'next_claim_at', ((today + 1)::timestamp AT TIME ZONE 'utc')
    );
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
  VALUES (uid, reward, 'daily_drop', 'daily_drop:' || uid::text || ':' || today::text);

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
  SET coin_balance = COALESCE(coin_balance, 0) + reward
  WHERE id = uid
  RETURNING coin_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'coins', reward,
    'balance', new_balance,
    'next_claim_at', ((today + 1)::timestamp AT TIME ZONE 'utc')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_drop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_drop() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_drop() TO service_role;
