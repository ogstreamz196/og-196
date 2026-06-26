
-- Default boss notification prefs: alert on EVERY sign-in (was previously off)
ALTER TABLE public.boss_notification_prefs
  ALTER COLUMN notify_every_signin SET DEFAULT true;

-- Flip existing boss/admin rows so current bosses start receiving every sign-in alert
UPDATE public.boss_notification_prefs
   SET notify_every_signin = true, updated_at = now()
 WHERE notify_every_signin = false;
