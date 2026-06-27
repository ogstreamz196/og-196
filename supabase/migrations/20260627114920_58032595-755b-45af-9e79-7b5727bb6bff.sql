-- 1) Songs: remove overly permissive "any signed-in user reads every completed song" policy.
-- Community discovery moves to a SECURITY DEFINER function that returns only safe, non-sensitive columns.
DROP POLICY IF EXISTS "Authenticated view completed songs" ON public.songs;

CREATE OR REPLACE FUNCTION public.list_community_songs(p_offset integer DEFAULT 0, p_limit integer DEFAULT 12)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  style text,
  cover_url text,
  audio_path text,
  sample_path text,
  stream_audio_url text,
  duration_seconds numeric,
  created_at timestamptz,
  completed_at timestamptz,
  status text,
  unlocked boolean,
  revealed boolean,
  is_variation boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.user_id, s.title, s.style, s.cover_url, s.audio_path, s.sample_path,
         s.stream_audio_url, s.duration_seconds, s.created_at, s.completed_at, s.status,
         s.unlocked, s.revealed, s.is_variation
  FROM public.songs s
  WHERE s.status = 'completed'
    AND COALESCE(s.revealed, true) = true
    AND (auth.uid() IS NULL OR s.user_id <> auth.uid())
    AND auth.uid() IS NOT NULL
  ORDER BY s.created_at DESC
  OFFSET GREATEST(0, COALESCE(p_offset, 0))
  LIMIT LEAST(50, GREATEST(1, COALESCE(p_limit, 12)));
$$;

REVOKE ALL ON FUNCTION public.list_community_songs(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_community_songs(integer, integer) TO authenticated;

-- 2) payment_refunds: scope policies to authenticated/service_role explicitly (no anon).
DROP POLICY IF EXISTS "Users can view own refunds" ON public.payment_refunds;
DROP POLICY IF EXISTS "Service role manages refunds" ON public.payment_refunds;

CREATE POLICY "Users can view own refunds"
  ON public.payment_refunds
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages refunds"
  ON public.payment_refunds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
