
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS custom_welcome_text text,
  ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS coin_cost_per_generation integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS allowed_styles text[];

ALTER TABLE public.portals
  ADD CONSTRAINT portals_status_chk CHECK (status IN ('active','maintenance'));
