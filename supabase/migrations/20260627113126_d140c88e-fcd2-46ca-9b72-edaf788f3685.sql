ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS messenger_mode text NOT NULL DEFAULT 'loner'
    CHECK (messenger_mode IN ('loner', 'community'));