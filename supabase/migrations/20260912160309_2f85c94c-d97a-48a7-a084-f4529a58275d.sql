UPDATE public.sports_guide_access
SET telegram_invite_link = 'https://t.me/+EJDV1q_eTtU3MmZk',
    invite_expires_at = NULL,
    invite_sent_at = NULL,
    status = CASE WHEN status = 'revoked' THEN status ELSE 'owned' END,
    updated_at = now()
WHERE status <> 'revoked';

CREATE OR REPLACE FUNCTION public.purchase_sports_guide_access_for_user(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.store_items%ROWTYPE;
  v_balance integer;
  v_existing public.sports_guide_access%ROWTYPE;
  v_invite_link constant text := 'https://t.me/+EJDV1q_eTtU3MmZk';
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'User required';
  END IF;

  SELECT * INTO v_existing
  FROM public.sports_guide_access
  WHERE user_id = p_user;

  IF FOUND AND v_existing.status <> 'revoked' THEN
    UPDATE public.sports_guide_access
    SET telegram_invite_link = v_invite_link,
        invite_expires_at = NULL,
        invite_sent_at = NULL,
        status = 'owned',
        updated_at = now()
    WHERE user_id = p_user;
    RETURN jsonb_build_object('ok', true, 'already_owned', true, 'status', 'owned');
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
  VALUES (p_user, -v_item.coin_price, 'sports_guide_access', 'sports-guide:' || p_user::text);

  INSERT INTO public.sports_guide_access (user_id, store_item_id, coin_cost, status, telegram_invite_link)
  VALUES (p_user, v_item.id, v_item.coin_price, 'owned', v_invite_link)
  ON CONFLICT (user_id) DO UPDATE SET
    store_item_id = EXCLUDED.store_item_id,
    coin_cost = EXCLUDED.coin_cost,
    status = 'owned',
    telegram_invite_link = v_invite_link,
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

REVOKE EXECUTE ON FUNCTION public.purchase_sports_guide_access_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_sports_guide_access_for_user(uuid) TO service_role;

DELETE FROM public.app_settings WHERE key = 'telegram.sports_guide_group_id';