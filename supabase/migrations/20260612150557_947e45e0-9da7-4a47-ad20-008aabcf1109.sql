
-- 1) Restrict authenticated users from updating sensitive profile columns (esp. coin_balance).
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, custom_bot_name, widget_deployed_domains) ON public.profiles TO authenticated;

-- 2) Remove sensitive tables from the Realtime publication so row changes
--    (emails, coin balances, song prompts/lyrics) don't broadcast to all
--    authenticated subscribers. Site_content stays (admin-edited, public copy).
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.songs;

-- 3) Lock down private storage buckets with explicit restrictive policies.
--    Today access is fine (no permissive policies + RLS on => deny), but
--    add explicit policies so future permissive additions can't accidentally
--    expose these buckets to end users. Service role bypasses RLS.
CREATE POLICY "Deny anon access to private buckets"
  ON storage.objects AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (bucket_id NOT IN ('song-files','og-bot-tokens'))
  WITH CHECK (bucket_id NOT IN ('song-files','og-bot-tokens'));

CREATE POLICY "Deny authenticated access to private buckets"
  ON storage.objects AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (bucket_id NOT IN ('song-files','og-bot-tokens'))
  WITH CHECK (bucket_id NOT IN ('song-files','og-bot-tokens'));
