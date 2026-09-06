CREATE TABLE public.device_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, user_id)
);
CREATE INDEX device_accounts_device_id_idx ON public.device_accounts(device_id);
GRANT ALL ON public.device_accounts TO service_role;
ALTER TABLE public.device_accounts ENABLE ROW LEVEL SECURITY;