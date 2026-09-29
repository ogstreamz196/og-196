ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS score_tenths smallint;
ALTER TABLE public.battle_tallies ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.battle_tallies ADD COLUMN IF NOT EXISTS last_battle_date date;
ALTER TABLE public.battle_tallies ADD COLUMN IF NOT EXISTS streak_bonus_date date;
CREATE INDEX IF NOT EXISTS community_messages_score_idx ON public.community_messages (created_at DESC, score_tenths DESC NULLS LAST);