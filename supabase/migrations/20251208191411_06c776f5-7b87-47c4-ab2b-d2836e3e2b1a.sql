-- Create mask_email function if it doesn't exist
CREATE OR REPLACE FUNCTION public.mask_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF email_input IS NULL OR email_input = '' THEN
    RETURN NULL;
  END IF;
  -- Show first 2 chars, mask middle, show domain
  RETURN CONCAT(
    LEFT(SPLIT_PART(email_input, '@', 1), 2),
    '***@',
    SPLIT_PART(email_input, '@', 2)
  );
END;
$$;