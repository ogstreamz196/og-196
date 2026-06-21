-- Fill in missing RLS policies so only the owner can mutate their data.
CREATE POLICY "Users update own og messages" ON public.og_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own preferences" ON public.user_preferences
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Defense-in-depth: revoke any latent anon access on these tables.
REVOKE ALL ON public.og_messages FROM anon;
REVOKE ALL ON public.user_preferences FROM anon;