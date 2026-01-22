-- Fix accept_invitation to get full_name from auth.users metadata and handle errors properly
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
    
  ELSIF v_invitation.invitation_type = 'organization_member' THEN
    -- Create client_users entry with proper error handling
    BEGIN
      INSERT INTO client_users (id, organization_id, role, full_name)
      VALUES (p_user_id, v_invitation.organization_id, v_invitation.role, v_full_name)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        role = EXCLUDED.role,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'User'), client_users.full_name);
    EXCEPTION WHEN OTHERS THEN
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
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_type', v_invitation.invitation_type,
    'organization_id', v_invitation.organization_id
  );
END;
$$;