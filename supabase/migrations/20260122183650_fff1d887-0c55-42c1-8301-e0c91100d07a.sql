-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);

-- Recreate get_invitation_by_token function with used_at and failed_attempts
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  role text,
  status text,
  invitation_type text,
  expires_at timestamptz,
  created_at timestamptz,
  used_at timestamptz,
  failed_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.organization_id,
    o.name AS organization_name,
    i.role,
    i.status,
    i.invitation_type,
    i.expires_at,
    i.created_at,
    i.used_at,
    i.failed_attempts
  FROM public.user_invitations i
  LEFT JOIN public.client_organizations o ON i.organization_id = o.id
  WHERE i.token = p_token;
END;
$$;