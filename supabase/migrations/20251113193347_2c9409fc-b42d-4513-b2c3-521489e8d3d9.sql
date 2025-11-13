-- Create a function to verify and use admin invite code (if not exists)
CREATE OR REPLACE FUNCTION public.verify_admin_invite_code(invite_code text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_record admin_invite_codes;
BEGIN
  -- Get the invite code
  SELECT * INTO code_record
  FROM admin_invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND used_at IS NULL;
  
  -- If code doesn't exist or is already used, return false
  IF code_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Mark code as used
  UPDATE admin_invite_codes
  SET used_at = now(),
      used_by = user_id
  WHERE id = code_record.id;
  
  -- Add admin role to user
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN true;
END;
$$;