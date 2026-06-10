CREATE TABLE public.og_bot_token_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_expires_at timestamptz,
  token_expires_at timestamptz,
  notes text,
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX og_bot_token_invites_code_idx ON public.og_bot_token_invites(code);
CREATE INDEX og_bot_token_invites_open_idx ON public.og_bot_token_invites(redeemed_at, revoked_at);

GRANT SELECT ON public.og_bot_token_invites TO authenticated;
GRANT ALL ON public.og_bot_token_invites TO service_role;

ALTER TABLE public.og_bot_token_invites ENABLE ROW LEVEL SECURITY;

-- Admins can list/inspect all invites. Users never need direct SELECT — they
-- only see what redeem_og_bot_invite returns. (No anon access.)
CREATE POLICY "Admins read all invites"
  ON public.og_bot_token_invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER og_bot_token_invites_set_updated_at
  BEFORE UPDATE ON public.og_bot_token_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Generate an invite code in the same style as personal bot tokens.
CREATE OR REPLACE FUNCTION public.gen_og_bot_invite_code()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'ogi_' || replace(gen_random_uuid()::text, '-', '')
                || replace(gen_random_uuid()::text, '-', '');
$$;

-- Boss creates an unclaimed invite with preset rights.
CREATE OR REPLACE FUNCTION public.create_og_bot_invite(
  p_claim_expires_at timestamptz DEFAULT NULL,
  p_token_expires_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  new_code := public.gen_og_bot_invite_code();

  INSERT INTO public.og_bot_token_invites(code, created_by, claim_expires_at, token_expires_at, notes)
    VALUES (new_code, auth.uid(), p_claim_expires_at, p_token_expires_at, NULLIF(btrim(p_notes), ''));

  RETURN new_code;
END;
$$;

-- Boss can revoke (kill) an unredeemed invite.
CREATE OR REPLACE FUNCTION public.revoke_og_bot_invite(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.og_bot_token_invites
    SET revoked_at = now(), updated_at = now()
    WHERE id = p_invite_id AND redeemed_at IS NULL AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- First-come-first-served claim. Returns the freshly minted personal token.
CREATE OR REPLACE FUNCTION public.redeem_og_bot_invite(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  inv RECORD;
  new_token text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lock the invite row to make the redemption race-safe.
  SELECT * INTO inv
    FROM public.og_bot_token_invites
    WHERE code = btrim(p_code)
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;
  IF inv.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_redeemed';
  END IF;
  IF inv.claim_expires_at IS NOT NULL AND inv.claim_expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  -- Grant og_bot role (no-op if already present).
  INSERT INTO public.user_roles(user_id, role)
    VALUES (caller, 'og_bot')
    ON CONFLICT (user_id, role) DO NOTHING;

  -- Mint / refresh the caller's personal bot token using the invite's preset expiry.
  new_token := public.gen_og_bot_token();
  INSERT INTO public.og_bot_tokens(user_id, token, expires_at)
    VALUES (caller, new_token, inv.token_expires_at)
    ON CONFLICT (user_id) DO UPDATE
      SET token = EXCLUDED.token,
          expires_at = EXCLUDED.expires_at,
          updated_at = now(),
          last_used_at = NULL,
          revoked_at = NULL;

  UPDATE public.og_bot_token_invites
    SET redeemed_by = caller, redeemed_at = now(), updated_at = now()
    WHERE id = inv.id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (caller, 0, 'og_bot_invite_redeem', 'invite:' || inv.id::text);

  RETURN new_token;
END;
$$;