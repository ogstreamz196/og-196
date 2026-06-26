UPDATE public.profiles SET coin_balance = COALESCE(coin_balance, 0) + 5
WHERE id = '82847bf8-1233-482f-8393-622c372479ed';

INSERT INTO public.coin_transactions (user_id, amount, type, reference)
VALUES ('82847bf8-1233-482f-8393-622c372479ed', 0, 'admin_mint',
  'reconcile:stripe:live:cs_live_a1YXjRB4vFr8p7qUjgxEt1A8prSzT6ys1wX8CFI1yfFcEruAzDq0iuMbHU');

CREATE OR REPLACE FUNCTION public.increment_coin_balance(_user_id uuid, _delta int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET coin_balance = COALESCE(coin_balance, 0) + _delta
  WHERE id = _user_id
  RETURNING coin_balance;
$$;

REVOKE ALL ON FUNCTION public.increment_coin_balance(uuid, int) FROM public;
REVOKE ALL ON FUNCTION public.increment_coin_balance(uuid, int) FROM anon;
REVOKE ALL ON FUNCTION public.increment_coin_balance(uuid, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coin_balance(uuid, int) TO service_role;