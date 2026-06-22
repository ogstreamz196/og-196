CREATE POLICY "Public reads buyCoins overrides"
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (key LIKE 'buyCoins.%');