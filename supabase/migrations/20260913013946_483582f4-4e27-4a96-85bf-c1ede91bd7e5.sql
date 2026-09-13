
CREATE TABLE public.vip_pass_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id uuid not null references public.vip_pass_credentials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);
GRANT SELECT ON public.vip_pass_purchases TO authenticated;
GRANT ALL ON public.vip_pass_purchases TO service_role;
ALTER TABLE public.vip_pass_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own vip pass purchase"
  ON public.vip_pass_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Reusable pool: no permanent assignment; one purchase per user.
CREATE OR REPLACE FUNCTION public.purchase_vip_pass_for_user(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price int;
  v_cred public.vip_pass_credentials%ROWTYPE;
  v_balance int;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Already bought: return the same assigned credential's current details.
  SELECT c.* INTO v_cred
  FROM public.vip_pass_purchases p
  JOIN public.vip_pass_credentials c ON c.id = p.credential_id
  WHERE p.user_id = p_user;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true,
      'username', v_cred.username, 'password', v_cred.password);
  END IF;

  SELECT coin_price INTO v_price FROM public.store_items WHERE slug = 'og-vip-pass';
  v_price := COALESCE(v_price, 25);

  SELECT coin_balance INTO v_balance FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_price THEN
    RAISE EXCEPTION 'Not enough OG Coins';
  END IF;

  -- Pick a random active login from the pool (reusable by many users).
  SELECT * INTO v_cred
  FROM public.vip_pass_credentials
  WHERE active
  ORDER BY random()
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sold out — no VIP passes available right now';
  END IF;

  UPDATE public.profiles SET coin_balance = coin_balance - v_price WHERE id = p_user;
  INSERT INTO public.coin_transactions (user_id, amount, type, reference)
  VALUES (p_user, -v_price, 'purchase', 'og-vip-pass');
  INSERT INTO public.vip_pass_purchases (user_id, credential_id)
  VALUES (p_user, v_cred.id);

  RETURN jsonb_build_object('ok', true, 'already_owned', false,
    'username', v_cred.username, 'password', v_cred.password);
END;
$$;
REVOKE ALL ON FUNCTION public.purchase_vip_pass_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_vip_pass_for_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_vip_pass_for_user(uuid) TO service_role;
