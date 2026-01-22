-- Create invitation_audit_logs table for tracking all invitation events
CREATE TABLE IF NOT EXISTS public.invitation_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID REFERENCES user_invitations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  email TEXT,
  user_id UUID,
  organization_id UUID,
  invitation_type TEXT,
  status TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'unknown', -- 'edge_function', 'rpc', 'frontend'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for querying by email and time
CREATE INDEX IF NOT EXISTS idx_invitation_audit_logs_email ON invitation_audit_logs(email);
CREATE INDEX IF NOT EXISTS idx_invitation_audit_logs_created_at ON invitation_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_audit_logs_event_type ON invitation_audit_logs(event_type);

-- Enable RLS
ALTER TABLE invitation_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view invitation audit logs"
ON invitation_audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert audit logs"
ON invitation_audit_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- Create helper function to log invitation events (callable from RPC)
CREATE OR REPLACE FUNCTION public.log_invitation_event(
  p_invitation_id UUID,
  p_event_type TEXT,
  p_email TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL,
  p_invitation_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'rpc'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO invitation_audit_logs (
    invitation_id, event_type, email, user_id, organization_id,
    invitation_type, status, error_message, metadata, source
  ) VALUES (
    p_invitation_id, p_event_type, p_email, p_user_id, p_organization_id,
    p_invitation_type, p_status, p_error_message, p_metadata, p_source
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Update accept_invitation to include logging
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_full_name text;
  v_result jsonb;
  v_log_id UUID;
BEGIN
  -- Log: Started accepting invitation
  PERFORM log_invitation_event(
    NULL, 'accept_started', NULL, p_user_id, NULL, NULL, NULL, NULL,
    jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
  );

  -- Get and lock the invitation
  SELECT * INTO v_invitation
  FROM user_invitations
  WHERE token = p_token
  FOR UPDATE;
  
  -- Validate invitation exists
  IF v_invitation IS NULL THEN
    PERFORM log_invitation_event(
      NULL, 'accept_failed', NULL, p_user_id, NULL, NULL, NULL, 
      'Invitation not found',
      jsonb_build_object('token_prefix', left(p_token, 8) || '...'), 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  
  -- Log: Found invitation
  PERFORM log_invitation_event(
    v_invitation.id, 'invitation_found', v_invitation.email, p_user_id, 
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status, 
    NULL, '{}'::jsonb, 'rpc'
  );
  
  -- Check if already accepted
  IF v_invitation.status = 'accepted' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation already accepted', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;
  
  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    UPDATE user_invitations SET status = 'expired' WHERE id = v_invitation.id;
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, 'expired',
      'Invitation has expired', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;
  
  -- Check if revoked
  IF v_invitation.status = 'revoked' THEN
    PERFORM log_invitation_event(
      v_invitation.id, 'accept_failed', v_invitation.email, p_user_id,
      v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
      'Invitation has been revoked', '{}'::jsonb, 'rpc'
    );
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has been revoked');
  END IF;
  
  -- Get full_name from auth.users metadata (where signup stores it), fallback to profiles.email, then 'User'
  SELECT COALESCE(
    raw_user_meta_data->>'full_name',
    (SELECT email FROM profiles WHERE id = p_user_id),
    'User'
  ) INTO v_full_name
  FROM auth.users
  WHERE id = p_user_id;
  
  -- If user not found in auth.users, still try profiles
  IF v_full_name IS NULL THEN
    SELECT COALESCE(email, 'User') INTO v_full_name FROM profiles WHERE id = p_user_id;
  END IF;
  
  -- Log: Processing invitation type
  PERFORM log_invitation_event(
    v_invitation.id, 'processing_' || v_invitation.invitation_type, v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, v_invitation.status,
    NULL, jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
  );
  
  -- Process based on invitation type
  IF v_invitation.invitation_type = 'platform_admin' THEN
    -- Grant platform admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    -- Mark onboarding as complete for platform admins
    UPDATE profiles
    SET 
      onboarding_completed = true,
      onboarding_completed_at = now()
    WHERE id = p_user_id;
    
    PERFORM log_invitation_event(
      v_invitation.id, 'admin_role_granted', v_invitation.email, p_user_id,
      NULL, 'platform_admin', NULL, NULL, '{}'::jsonb, 'rpc'
    );
    
  ELSIF v_invitation.invitation_type = 'organization_member' THEN
    -- Create client_users entry with proper error handling
    BEGIN
      INSERT INTO client_users (id, organization_id, role, full_name)
      VALUES (p_user_id, v_invitation.organization_id, v_invitation.role, v_full_name)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), client_users.full_name);
        
      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_created', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL, NULL,
        jsonb_build_object('full_name', v_full_name, 'role', v_invitation.role), 'rpc'
      );
    EXCEPTION WHEN OTHERS THEN
      PERFORM log_invitation_event(
        v_invitation.id, 'client_user_failed', v_invitation.email, p_user_id,
        v_invitation.organization_id, 'organization_member', NULL,
        'Failed to create organization membership: ' || SQLERRM,
        jsonb_build_object('sqlstate', SQLSTATE), 'rpc'
      );
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Failed to create organization membership: ' || SQLERRM
      );
    END;
    
    -- Mark onboarding as complete for organization members
    UPDATE profiles
    SET 
      onboarding_completed = true,
      onboarding_completed_at = now()
    WHERE id = p_user_id;
  END IF;
  
  -- Mark invitation as accepted
  UPDATE user_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;
  
  -- Log: Success
  PERFORM log_invitation_event(
    v_invitation.id, 'accept_success', v_invitation.email, p_user_id,
    v_invitation.organization_id, v_invitation.invitation_type, 'accepted',
    NULL, '{}'::jsonb, 'rpc'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_type', v_invitation.invitation_type,
    'organization_id', v_invitation.organization_id
  );
END;
$$;