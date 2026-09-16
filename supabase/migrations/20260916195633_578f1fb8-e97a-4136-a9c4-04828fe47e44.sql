CREATE TABLE public.tiktok_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL UNIQUE,
  drive_file_id text,
  drive_url text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tiktok_renders TO service_role;
ALTER TABLE public.tiktok_renders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiktok_renders_service_only"
ON public.tiktok_renders FOR ALL TO service_role
USING (true) WITH CHECK (true);