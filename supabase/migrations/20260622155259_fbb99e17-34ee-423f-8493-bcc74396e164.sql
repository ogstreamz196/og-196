DROP POLICY IF EXISTS "Public reads og_persona content" ON public.site_content;

CREATE POLICY "Authenticated reads og_persona content"
  ON public.site_content
  FOR SELECT
  TO authenticated
  USING (key LIKE 'og_persona.%');