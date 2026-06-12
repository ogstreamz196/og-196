CREATE TABLE public.og_bot_remote_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  signing_secret text NOT NULL,
  external_user text,
  origin_host text NOT NULL,
  expires_at timestamptz,
  uses_remaining int,
  grants_vip boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.og_bot_remote_tokens TO service_role;
-- intentionally no anon/authenticated grants: only server fns touch this.

ALTER TABLE public.og_bot_remote_tokens ENABLE ROW LEVEL SECURITY;

-- No policies needed: without GRANTs, anon/authenticated cannot reach the
-- table at all via PostgREST. Service-role bypasses RLS.

CREATE INDEX og_bot_remote_tokens_created_by_idx
  ON public.og_bot_remote_tokens (created_by, created_at DESC);

-- Safe listing function: returns everything EXCEPT signing_secret.
-- Admin-only; called from a server fn after auth check.
CREATE OR REPLACE FUNCTION public.list_og_bot_remote_tokens_safe()
RETURNS TABLE (
  id uuid,
  token text,
  external_user text,
  origin_host text,
  expires_at timestamptz,
  uses_remaining int,
  grants_vip boolean,
  revoked_at timestamptz,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, token, external_user, origin_host, expires_at, uses_remaining,
         grants_vip, revoked_at, created_at, created_by
  FROM public.og_bot_remote_tokens
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_og_bot_remote_tokens_safe() TO authenticated;