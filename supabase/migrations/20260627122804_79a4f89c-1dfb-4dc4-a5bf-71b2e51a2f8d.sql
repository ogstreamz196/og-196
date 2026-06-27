
CREATE TABLE public.unlocked_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'coins',
  cost_coins integer,
  reference text,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX idx_unlocked_songs_user ON public.unlocked_songs(user_id);
CREATE INDEX idx_unlocked_songs_song ON public.unlocked_songs(song_id);

GRANT SELECT ON public.unlocked_songs TO authenticated;
GRANT ALL ON public.unlocked_songs TO service_role;

ALTER TABLE public.unlocked_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own unlocks"
  ON public.unlocked_songs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Backfill from existing songs.unlocked flag so currently-unlocked tracks remain downloadable
INSERT INTO public.unlocked_songs (user_id, song_id, source, reference)
SELECT s.user_id, s.id, 'backfill', 'songs.unlocked'
FROM public.songs s
WHERE s.unlocked = true AND s.user_id IS NOT NULL
ON CONFLICT (user_id, song_id) DO NOTHING;
