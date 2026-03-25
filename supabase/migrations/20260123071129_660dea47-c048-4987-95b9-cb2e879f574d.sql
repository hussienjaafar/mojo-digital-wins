-- Fix user_invitations public access vulnerability
-- The "Anyone can read invitation by token" policy exposes all emails and tokens

-- Step 1: Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON user_invitations;

-- Step 2: Drop existing function and recreate with proper return type
DROP FUNCTION IF EXISTS public.get_invitation_by_token(TEXT);

-- Create a SECURITY DEFINER function for safe token lookup
-- This only returns minimal info needed for the invitation acceptance flow
-- without exposing the full table
CREATE FUNCTION public.get_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  organization_id UUID,
  organization_name TEXT,
  invitation_type TEXT,
  role TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Get the invitation
  SELECT 
    ui.id,
    ui.email,
    ui.organization_id,
    ui.invitation_type,
    ui.role,
    ui.status,
    ui.expires_at,
    co.name as org_name
  INTO v_invitation
  FROM user_invitations ui
  LEFT JOIN client_organizations co ON ui.organization_id = co.id
  WHERE ui.token = p_token;
  
  -- If not found, return empty
  IF v_invitation.id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the invitation with validity check
  RETURN QUERY SELECT
    v_invitation.id,
    v_invitation.email,
    v_invitation.organization_id,
    v_invitation.org_name,
    v_invitation.invitation_type,
    v_invitation.role,
    v_invitation.status,
    v_invitation.expires_at,
    (v_invitation.status = 'pending' AND v_invitation.expires_at > NOW()) as is_valid;
END;
$$;

-- Step 3: Create a policy that allows authenticated users to see their own invitations
-- (invitations sent TO their email address)
CREATE POLICY "Users can view invitations sent to their email"
ON user_invitations FOR SELECT TO authenticated
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR email = (SELECT email FROM profiles WHERE id = auth.uid())
);

-- Grant execute on the safe lookup function to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(TEXT) TO authenticated;

-- Add comment explaining the security model
COMMENT ON FUNCTION public.get_invitation_by_token IS 
'Safe token lookup for invitation acceptance flow. Returns minimal invitation info without exposing the full table.
This replaces the dangerous "Anyone can read invitation by token" RLS policy.
Tokens should be treated as secrets and only shared via email links.';

COMMENT ON TABLE user_invitations IS 
'Stores user invitations with secure access controls.
- Direct table access is restricted to admins and users viewing their own invitations
- Token-based lookups use get_invitation_by_token() function for anonymous access
- accept_invitation() RPC handles secure token validation and acceptance';