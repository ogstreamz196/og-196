REVOKE EXECUTE ON FUNCTION public.pay_referral_cashback_on_burn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_app_settings_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_coin_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_generation_capacity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_generation_capacity(uuid) TO service_role;