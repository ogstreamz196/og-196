
-- Short, unique, shareable OG referral code on profiles + lookup-by-code RPC
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_og_referral_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  attempts int := 0;
BEGIN
  LOOP
    code := 'OG-';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 20 THEN
      RETURN 'OG-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
    END IF;
  END LOOP;
END $$;

-- Backfill any null codes
UPDATE public.profiles SET referral_code = public.gen_og_referral_code() WHERE referral_code IS NULL;

-- Default for new profiles
ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT public.gen_og_referral_code();

-- Update binding-related RPCs to include the code and timestamp
CREATE OR REPLACE FUNCTION public.get_my_referrer()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  ref RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT r.referrer_id,
         r.created_at AS bound_at,
         COALESCE(p.display_name, split_part(p.email,'@',1), 'Unknown') AS name,
         p.referral_code AS code
    INTO ref
    FROM public.referrals r
    LEFT JOIN public.profiles p ON p.id = r.referrer_id
    WHERE r.referee_id = caller;
  IF ref.referrer_id IS NULL THEN
    RETURN jsonb_build_object('has_referrer', false);
  END IF;
  RETURN jsonb_build_object(
    'has_referrer', true,
    'referrer_id', ref.referrer_id,
    'referrer_name', ref.name,
    'referrer_code', ref.code,
    'bound_at', ref.bound_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.lookup_referrer(p_referrer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  rec RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id,
         COALESCE(display_name, split_part(email,'@',1), 'Unknown') AS name,
         referral_code
    INTO rec
    FROM public.profiles WHERE id = p_referrer;
  IF rec.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'referrer_id', rec.id, 'referrer_name', rec.name, 'referrer_code', rec.referral_code);
END $$;

CREATE OR REPLACE FUNCTION public.lookup_referrer_by_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  rec RECORD;
  clean text := upper(btrim(p_code));
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF clean IS NULL OR length(clean) < 3 THEN RETURN jsonb_build_object('found', false); END IF;
  -- accept "OG-XXXXXX" or raw 6-char body
  IF clean NOT LIKE 'OG-%' THEN clean := 'OG-' || clean; END IF;
  SELECT id,
         COALESCE(display_name, split_part(email,'@',1), 'Unknown') AS name,
         referral_code
    INTO rec
    FROM public.profiles WHERE referral_code = clean;
  IF rec.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object('found', true, 'referrer_id', rec.id, 'referrer_name', rec.name, 'referrer_code', rec.referral_code);
END $$;
