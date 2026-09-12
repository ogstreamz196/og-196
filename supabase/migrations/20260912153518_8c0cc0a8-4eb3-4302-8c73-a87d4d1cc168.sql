ALTER TABLE public.store_items
  ADD COLUMN coin_price integer CHECK (coin_price IS NULL OR coin_price >= 0);

CREATE TABLE public.sports_guide_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  store_item_id uuid NOT NULL REFERENCES public.store_items(id) ON DELETE RESTRICT,
  coin_cost integer NOT NULL CHECK (coin_cost >= 0),
  status text NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'invite_sent', 'joined', 'revoked')),
  telegram_invite_link text,
  invite_expires_at timestamptz,
  invite_sent_at timestamptz,
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sports_guide_access TO authenticated;
GRANT ALL ON public.sports_guide_access TO service_role;
ALTER TABLE public.sports_guide_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sports guide access"
  ON public.sports_guide_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_sports_guide_access_updated
  BEFORE UPDATE ON public.sports_guide_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_store_updated_at();

CREATE OR REPLACE FUNCTION public.purchase_sports_guide_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item public.store_items%ROWTYPE;
  v_balance integer;
  v_existing public.sports_guide_access%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_existing
  FROM public.sports_guide_access
  WHERE user_id = v_user;

  IF FOUND AND v_existing.status <> 'revoked' THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'status', v_existing.status);
  END IF;

  SELECT * INTO v_item
  FROM public.store_items
  WHERE slug = 'og-sports-guide-access' AND active = true
  FOR UPDATE;

  IF NOT FOUND OR v_item.coin_price IS NULL THEN
    RAISE EXCEPTION 'OG Sports Guide Access is unavailable';
  END IF;

  IF v_item.stock IS NOT NULL AND v_item.stock_sold >= v_item.stock THEN
    RAISE EXCEPTION 'OG Sports Guide Access is sold out';
  END IF;

  SELECT coin_balance INTO v_balance
  FROM public.profiles
  WHERE id = v_user
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_item.coin_price THEN
    RAISE EXCEPTION 'Not enough OG Coins';
  END IF;

  UPDATE public.profiles
  SET coin_balance = coin_balance - v_item.coin_price,
      updated_at = now()
  WHERE id = v_user;

  INSERT INTO public.coin_transactions (user_id, amount, type, reference)
  VALUES (v_user, -v_item.coin_price, 'sports_guide_access', 'sports-guide:' || v_user::text);

  INSERT INTO public.sports_guide_access (user_id, store_item_id, coin_cost, status)
  VALUES (v_user, v_item.id, v_item.coin_price, 'owned')
  ON CONFLICT (user_id) DO UPDATE SET
    store_item_id = EXCLUDED.store_item_id,
    coin_cost = EXCLUDED.coin_cost,
    status = 'owned',
    telegram_invite_link = NULL,
    invite_expires_at = NULL,
    invite_sent_at = NULL,
    joined_at = NULL,
    revoked_at = NULL,
    updated_at = now();

  UPDATE public.store_items
  SET stock_sold = stock_sold + 1
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_owned', false,
    'status', 'owned',
    'coin_balance', v_balance - v_item.coin_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_sports_guide_access() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_sports_guide_access() FROM anon;

CREATE INDEX idx_sports_guide_access_status ON public.sports_guide_access(status);