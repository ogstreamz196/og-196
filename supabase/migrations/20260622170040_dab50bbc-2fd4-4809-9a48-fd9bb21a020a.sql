REVOKE ALL ON FUNCTION public.refund_generation_charge(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_generation_charge(uuid, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.refund_generation_charge(uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_charge(uuid, integer, text) TO service_role;