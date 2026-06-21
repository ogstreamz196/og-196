
-- 1. Default foul_mouth to OFF for new users
ALTER TABLE public.user_preferences ALTER COLUMN foul_mouth SET DEFAULT false;

-- Reset users who never explicitly toggled it (created_at == updated_at)
UPDATE public.user_preferences
  SET foul_mouth = false
  WHERE foul_mouth = true
    AND updated_at = created_at;

-- 2. Shared OG chat memory between widget and messenger
CREATE TABLE IF NOT EXISTS public.og_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant','system')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS og_messages_user_created_idx
  ON public.og_messages (user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.og_messages TO authenticated;
GRANT ALL ON public.og_messages TO service_role;

ALTER TABLE public.og_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own og messages"
  ON public.og_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own og messages"
  ON public.og_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own og messages"
  ON public.og_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Enable realtime so widget & messenger sync instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.og_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;
