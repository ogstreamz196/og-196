ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS vocals_only BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beat_path TEXT;

DROP POLICY IF EXISTS "Users manage their own beats" ON storage.objects;
CREATE POLICY "Users manage their own beats"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'beats' AND owner = auth.uid())
WITH CHECK (bucket_id = 'beats' AND owner = auth.uid());