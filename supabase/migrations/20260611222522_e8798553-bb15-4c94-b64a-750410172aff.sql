
-- Generator for cryptographically-strong developer token strings
CREATE OR REPLACE FUNCTION public.gen_bot_token_string()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT 'og_live_' || replace(gen_random_uuid()::text, '-', '')
                    || replace(gen_random_uuid()::text, '-', '');
$$;

-- Table
CREATE TABLE public.bot_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_string text NOT NULL UNIQUE DEFAULT public.gen_bot_token_string(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  allowed_domain text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bot_tokens_developer_id_idx ON public.bot_tokens(developer_id);
CREATE INDEX bot_tokens_token_string_idx ON public.bot_tokens(token_string);

-- Grants (RLS-only access; no anon — validation goes through SECURITY DEFINER fn)
GRANT SELECT, UPDATE ON public.bot_tokens TO authenticated;
GRANT ALL ON public.bot_tokens TO service_role;

-- RLS
ALTER TABLE public.bot_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can view their own tokens"
  ON public.bot_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = developer_id);

CREATE POLICY "Developers can update their own tokens"
  ON public.bot_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = developer_id)
  WITH CHECK (auth.uid() = developer_id AND status IN ('active','suspended'));

CREATE POLICY "Admins can view all tokens"
  ON public.bot_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER bot_tokens_set_updated_at
  BEFORE UPDATE ON public.bot_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Purchase function: deduct coins + mint a token for the caller
CREATE OR REPLACE FUNCTION public.purchase_bot_token(p_allowed_domain text DEFAULT NULL)
RETURNS TABLE(id uuid, token_string text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  cost   integer := 25;
  new_balance integer;
  new_id uuid;
  new_token text;
  domain_clean text := NULLIF(btrim(p_allowed_domain), '');
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF domain_clean IS NOT NULL AND length(domain_clean) > 253 THEN
    RAISE EXCEPTION 'invalid_domain';
  END IF;

  -- Deduct 25 coins (bypass self-balance trigger)
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  UPDATE public.profiles
    SET coin_balance = coin_balance - cost
    WHERE id = caller AND coin_balance >= cost
    RETURNING coin_balance INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  new_token := public.gen_bot_token_string();

  INSERT INTO public.bot_tokens(developer_id, token_string, allowed_domain)
    VALUES (caller, new_token, domain_clean)
    RETURNING bot_tokens.id INTO new_id;

  INSERT INTO public.coin_transactions(user_id, amount, type, reference)
    VALUES (caller, -cost, 'bot_token_purchase', 'bot_token:' || new_id::text);

  RETURN QUERY SELECT new_id, new_token;
END;
$$;

-- Public validation function — safe to expose to anon for widget bootstrap
CREATE OR REPLACE FUNCTION public.validate_bot_token(p_token text, p_origin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_status text;
  row_domain text;
  origin_host text;
  allowed_host text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 200 THEN
    RETURN false;
  END IF;
  IF p_origin IS NULL OR length(p_origin) > 500 THEN
    RETURN false;
  END IF;

  SELECT status, allowed_domain INTO row_status, row_domain
    FROM public.bot_tokens WHERE token_string = p_token;

  IF NOT FOUND OR row_status <> 'active' THEN
    RETURN false;
  END IF;

  -- If no domain hardwired yet, treat as not-yet-bound (reject)
  IF row_domain IS NULL OR length(btrim(row_domain)) = 0 THEN
    RETURN false;
  END IF;

  -- Normalize: strip scheme + trailing slash + path
  origin_host  := lower(regexp_replace(p_origin,  '^https?://', ''));
  origin_host  := split_part(split_part(origin_host, '/', 1), ':', 1);
  allowed_host := lower(regexp_replace(row_domain, '^https?://', ''));
  allowed_host := split_part(split_part(allowed_host, '/', 1), ':', 1);

  RETURN origin_host = allowed_host;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_bot_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_bot_token(text, text) TO anon, authenticated;
