CREATE OR REPLACE FUNCTION public.add_battle_reward(_user_id uuid, _earned_tenths integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tally public.battle_tallies%ROWTYPE;
  safe_reward integer := LEAST(10, GREATEST(0, COALESCE(_earned_tenths, 0)));
BEGIN
  INSERT INTO public.battle_tallies(user_id, pending_tenths, rounds, total_awarded_coins, updated_at)
  VALUES (_user_id, 0, 0, 0, to_timestamp(0))
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO tally
  FROM public.battle_tallies
  WHERE user_id = _user_id
  FOR UPDATE;

  IF tally.updated_at > now() - interval '2 seconds' THEN
    RETURN jsonb_build_object(
      'earned_tenths', 0,
      'pending_tenths', tally.pending_tenths,
      'rounds', tally.rounds,
      'rate_limited', true
    );
  END IF;

  UPDATE public.battle_tallies
  SET pending_tenths = pending_tenths + safe_reward,
      rounds = rounds + 1,
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING * INTO tally;

  RETURN jsonb_build_object(
    'earned_tenths', safe_reward,
    'pending_tenths', tally.pending_tenths,
    'rounds', tally.rounds,
    'rate_limited', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_battle_reward(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_battle_reward(uuid, integer) TO service_role;