ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS text_scale numeric(3,2) NOT NULL DEFAULT 1.00
    CHECK (text_scale >= 0.85 AND text_scale <= 1.50),
  ADD COLUMN IF NOT EXISTS density text NOT NULL DEFAULT 'comfortable'
    CHECK (density IN ('comfortable','compact','spacious'));