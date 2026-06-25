CREATE TABLE public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user','bot')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_messages_created_at_idx ON public.community_messages (created_at DESC);

GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read community"
  ON public.community_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can post as themselves"
  ON public.community_messages FOR INSERT
  TO authenticated
  WITH CHECK (role = 'user' AND user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;