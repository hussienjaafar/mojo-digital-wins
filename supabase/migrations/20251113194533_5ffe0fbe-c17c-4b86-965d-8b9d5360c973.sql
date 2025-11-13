-- Add expires_at column to admin_invite_codes
ALTER TABLE public.admin_invite_codes 
ADD COLUMN expires_at timestamp with time zone DEFAULT (now() + interval '7 days');

-- Fix infinite recursion in user_roles RLS policy
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update verify_admin_invite_code function to check expiration
CREATE OR REPLACE FUNCTION public.verify_admin_invite_code(invite_code text, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  code_record admin_invite_codes;
BEGIN
  -- Get the invite code
  SELECT * INTO code_record
  FROM admin_invite_codes
  WHERE code = invite_code
    AND is_active = true
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());
  
  -- If code doesn't exist, is already used, or is expired, return false
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