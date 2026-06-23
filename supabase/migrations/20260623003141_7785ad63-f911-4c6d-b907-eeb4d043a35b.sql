
CREATE OR REPLACE FUNCTION public.dev_send_og_message_as_bot(
  target_user_id uuid,
  message_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  caller uuid := auth.uid();
  trimmed text := NULLIF(btrim(message_content), '');
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT (public.has_role(caller, 'dev'::public.app_role)
       OR public.has_role(caller, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF trimmed IS NULL OR length(trimmed) > 4000 THEN
    RAISE EXCEPTION 'invalid_content';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.og_messages(user_id, role, content)
    VALUES (target_user_id, 'assistant', trimmed)
    RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_send_og_message_as_bot(uuid, text) TO authenticated;
