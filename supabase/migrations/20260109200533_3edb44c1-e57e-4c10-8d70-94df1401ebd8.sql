-- Create user_invitations table for unified invitation flow
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invitation_type text NOT NULL CHECK (invitation_type IN ('platform_admin', 'organization_member')),
  organization_id uuid REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  role text CHECK (role IS NULL OR role IN ('admin', 'manager', 'viewer')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  
  -- Ensure organization_id is required for org member invites
  CONSTRAINT org_required_for_org_invites CHECK (
    (invitation_type = 'platform_admin' AND organization_id IS NULL) OR
    (invitation_type = 'organization_member' AND organization_id IS NOT NULL AND role IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all invitations
CREATE POLICY "Platform admins can manage all invitations"
ON public.user_invitations
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Organization admins can manage their org's invitations
CREATE POLICY "Org admins can manage their org invitations"
ON public.user_invitations
FOR ALL
USING (
  invitation_type = 'organization_member' AND
  organization_id IN (
    SELECT organization_id FROM public.client_users 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  invitation_type = 'organization_member' AND
  organization_id IN (
    SELECT organization_id FROM public.client_users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Anyone can read invitations by token (for acceptance flow)
CREATE POLICY "Anyone can read invitation by token"
ON public.user_invitations
FOR SELECT
USING (true);

-- Create index for token lookups
CREATE INDEX idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX idx_user_invitations_status ON public.user_invitations(status);
CREATE INDEX idx_user_invitations_organization ON public.user_invitations(organization_id) WHERE organization_id IS NOT NULL;

-- Function to get invitation by token
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  invitation_type text,
  organization_id uuid,
  organization_name text,
  role text,
  status text,
  expires_at timestamptz
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
    i.invitation_type,
    i.organization_id,
    co.name as organization_name,
    i.role,
    i.status,
    i.expires_at
  FROM user_invitations i
  LEFT JOIN client_organizations co ON co.id = i.organization_id
  WHERE i.token = p_token;
END;
$$;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_result jsonb;
BEGIN
  -- Get and lock the invitation
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE token = p_token
  FOR UPDATE;
  
  -- Validate invitation exists
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  
  -- Check if already accepted
  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;
  
  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    UPDATE user_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;
  
  -- Check if revoked
  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has been revoked');
  END IF;
  
  -- Process based on invitation type
  IF v_invitation.invitation_type = 'platform_admin' THEN
    -- Grant platform admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_invitation.invitation_type = 'organization_member' THEN
    -- Get user's profile info
    DECLARE
      v_full_name text;
    BEGIN
      SELECT COALESCE(email, 'User') INTO v_full_name FROM profiles WHERE id = p_user_id;
      
      -- Create client_users entry
      INSERT INTO client_users (id, organization_id, role, full_name)
      VALUES (p_user_id, v_invitation.organization_id, v_invitation.role, v_full_name)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role;
    END;
  END IF;
  
  -- Mark invitation as accepted
  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_type', v_invitation.invitation_type,
    'organization_id', v_invitation.organization_id
  );
END;
$$;

-- Function to get pending invitations for admin views
CREATE OR REPLACE FUNCTION public.get_pending_invitations(p_type text DEFAULT NULL, p_organization_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  email text,
  invitation_type text,
  organization_id uuid,
  organization_name text,
  role text,
  invited_by uuid,
  invited_by_email text,
  created_at timestamptz,
  expires_at timestamptz,
  status text
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
    i.invitation_type,
    i.organization_id,
    co.name as organization_name,
    i.role,
    i.invited_by,
    p.email as invited_by_email,
    i.created_at,
    i.expires_at,
    i.status
  FROM user_invitations i
  LEFT JOIN client_organizations co ON co.id = i.organization_id
  LEFT JOIN profiles p ON p.id = i.invited_by
  WHERE 
    (p_type IS NULL OR i.invitation_type = p_type)
    AND (p_organization_id IS NULL OR i.organization_id = p_organization_id)
    AND i.status = 'pending'
  ORDER BY i.created_at DESC;
END;
$$;