-- TV HUB removal
DROP FUNCTION IF EXISTS public.tv_items(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.tv_categories(text);
DROP FUNCTION IF EXISTS public.tv_catalog_finish(uuid, integer);
DROP TABLE IF EXISTS public.tv_catalog_items;
DROP TABLE IF EXISTS public.tv_catalog_categories;
DROP TABLE IF EXISTS public.tv_catalog_meta;

-- OG VIP PASS credential pool
CREATE TABLE public.vip_pass_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password text NOT NULL,
  note text,
  active boolean NOT NULL DEFAULT true,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  coin_cost integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX vip_pass_credentials_username_key ON public.vip_pass_credentials (lower(username));
CREATE UNIQUE INDEX vip_pass_credentials_one_per_user ON public.vip_pass_credentials (assigned_user_id) WHERE assigned_user_id IS NOT NULL;

GRANT ALL ON public.vip_pass_credentials TO service_role;
ALTER TABLE public.vip_pass_credentials ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated access: all reads and writes go through trusted server functions.

CREATE TRIGGER vip_pass_credentials_updated_at
BEFORE UPDATE ON public.vip_pass_credentials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.purchase_vip_pass_for_user(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.store_items%ROWTYPE;
  v_balance integer;
  v_cred public.vip_pass_credentials%ROWTYPE;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'User required';
  END IF;

  SELECT * INTO v_cred
  FROM public.vip_pass_credentials
  WHERE assigned_user_id = p_user;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true,
      'username', v_cred.username, 'password', v_cred.password);
  END IF;

  SELECT * INTO v_item
  FROM public.store_items
  WHERE slug = 'og-vip-pass' AND active = true
  FOR UPDATE;

  IF NOT FOUND OR v_item.coin_price IS NULL THEN
    RAISE EXCEPTION 'OG VIP Pass is unavailable';
  END IF;

  SELECT * INTO v_cred
  FROM public.vip_pass_credentials
  WHERE assigned_user_id IS NULL AND active = true
  ORDER BY random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OG VIP Pass is sold out — no passes left';
  END IF;

  SELECT coin_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_item.coin_price THEN
    RAISE EXCEPTION 'Not enough OG Coins';
  END IF;

  UPDATE public.profiles
  SET coin_balance = coin_balance - v_item.coin_price,
      updated_at = now()
  WHERE id = p_user;

  INSERT INTO public.coin_transactions (user_id, amount, type, reference)
  VALUES (p_user, -v_item.coin_price, 'vip_pass', 'vip-pass:' || p_user::text);

  UPDATE public.vip_pass_credentials
  SET assigned_user_id = p_user,
      assigned_at = now(),
      coin_cost = v_item.coin_price
  WHERE id = v_cred.id;

  UPDATE public.store_items
  SET stock_sold = stock_sold + 1
  WHERE id = v_item.id;

  RETURN jsonb_build_object('ok', true, 'already_owned', false,
    'username', v_cred.username, 'password', v_cred.password);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_vip_pass_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_vip_pass_for_user(uuid) TO service_role;

INSERT INTO public.store_items
  (category_id, slug, name, description, price_cents, coin_price, currency, rarity, sort_order, active, perk_slug)
SELECT c.id, 'og-vip-pass', 'OG VIP PASS',
  'Unlock your own private OG VIP login — a username and password are assigned to you instantly.',
  0, 25, 'gbp', 'legendary', 1, true, 'vip:pass'
FROM public.store_categories c
WHERE c.slug = 'items'
ON CONFLICT DO NOTHING;