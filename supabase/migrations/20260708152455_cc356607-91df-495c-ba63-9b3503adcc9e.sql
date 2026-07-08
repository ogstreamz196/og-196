CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.song_brief_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT,
  original_text TEXT NOT NULL,
  improved_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_brief_drafts TO authenticated;
GRANT ALL ON public.song_brief_drafts TO service_role;

ALTER TABLE public.song_brief_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own song brief drafts"
  ON public.song_brief_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX song_brief_drafts_user_created_idx
  ON public.song_brief_drafts (user_id, created_at DESC);

CREATE TRIGGER trg_song_brief_drafts_updated_at
  BEFORE UPDATE ON public.song_brief_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
