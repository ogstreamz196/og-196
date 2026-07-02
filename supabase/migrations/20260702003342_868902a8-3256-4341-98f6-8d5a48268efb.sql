-- Store CMS: categories + items
CREATE TABLE IF NOT EXISTS public.store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_categories TO anon, authenticated;
GRANT ALL ON public.store_categories TO service_role;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories readable by all"
  ON public.store_categories FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage categories"
  ON public.store_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.store_categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  recurring_interval text CHECK (recurring_interval IN ('month','year')),
  stripe_product_id text,
  stripe_price_id text,
  stock int,
  stock_sold int NOT NULL DEFAULT 0,
  coin_reward int,
  perk_slug text,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_items_category ON public.store_items(category_id);
CREATE INDEX IF NOT EXISTS idx_store_items_active ON public.store_items(active);

GRANT SELECT ON public.store_items TO anon, authenticated;
GRANT ALL ON public.store_items TO service_role;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items readable by all when active"
  ON public.store_items FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage items"
  ON public.store_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_store_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_store_categories_updated
  BEFORE UPDATE ON public.store_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_store_updated_at();

CREATE TRIGGER trg_store_items_updated
  BEFORE UPDATE ON public.store_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_store_updated_at();

-- Seed categories
INSERT INTO public.store_categories (slug, label, description, sort_order) VALUES
  ('coins', 'OG Coin Vault', 'Top up your OG coin wallet.', 1),
  ('subscriptions', 'VIP Memberships', 'Recurring perks & unlocks.', 2),
  ('items', 'Random Items', 'Limited drops, cosmetics & one-offs.', 3)
ON CONFLICT (slug) DO NOTHING;