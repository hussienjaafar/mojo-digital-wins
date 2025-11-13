-- Create admin invite codes table
CREATE TABLE public.admin_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamp with time zone,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_invite_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can view invite codes
CREATE POLICY "Only admins can view invite codes"
ON public.admin_invite_codes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can create invite codes
CREATE POLICY "Only admins can create invite codes"
ON public.admin_invite_codes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update invite codes
CREATE POLICY "Only admins can update invite codes"
ON public.admin_invite_codes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete invite codes
CREATE POLICY "Only admins can delete invite codes"
ON public.admin_invite_codes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a function to verify and use admin invite code
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