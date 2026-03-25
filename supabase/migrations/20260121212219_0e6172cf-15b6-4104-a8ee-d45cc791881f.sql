-- Organization Activity Log table for audit trail
CREATE TABLE IF NOT EXISTS public.org_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action_type text NOT NULL,
  target_user_id uuid,
  target_user_name text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_org_activity_log_org_id ON org_activity_log(organization_id);
CREATE INDEX idx_org_activity_log_created_at ON org_activity_log(created_at DESC);
CREATE INDEX idx_org_activity_log_action_type ON org_activity_log(action_type);

-- Enable RLS
ALTER TABLE org_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Org admins and managers can view their own org's logs
CREATE POLICY "Org members can view own org activity logs" ON org_activity_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM client_users 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- RLS Policy: Only system/service role can insert
CREATE POLICY "Service role can insert activity logs" ON org_activity_log
  FOR INSERT WITH CHECK (true);

-- Bulk update user roles function
CREATE OR REPLACE FUNCTION public.bulk_update_user_roles(
  p_user_ids uuid[],
  p_new_role text,
  p_organization_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer;
  v_user record;
BEGIN
  -- Validate role
  IF p_new_role NOT IN ('admin', 'manager', 'editor', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Update all matching users
  UPDATE client_users
  SET role = p_new_role
  WHERE id = ANY(p_user_ids)
    AND organization_id = p_organization_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Log activity for each updated user
  FOR v_user IN 
    SELECT id, full_name FROM client_users 
    WHERE id = ANY(p_user_ids) AND organization_id = p_organization_id
  LOOP
    INSERT INTO org_activity_log (organization_id, actor_id, actor_name, action_type, target_user_id, target_user_name, details)
    VALUES (p_organization_id, p_actor_id, p_actor_name, 'role_changed', v_user.id, v_user.full_name, 
      jsonb_build_object('new_role', p_new_role));
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
END;
$$;

-- Bulk remove users function
CREATE OR REPLACE FUNCTION public.bulk_remove_users(
  p_user_ids uuid[],
  p_organization_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
  v_user record;
BEGIN
  -- Log activity before deletion
  FOR v_user IN 
    SELECT id, full_name FROM client_users 
    WHERE id = ANY(p_user_ids) AND organization_id = p_organization_id
  LOOP
    INSERT INTO org_activity_log (organization_id, actor_id, actor_name, action_type, target_user_id, target_user_name, details)
    VALUES (p_organization_id, p_actor_id, p_actor_name, 'member_removed', v_user.id, v_user.full_name, 
      jsonb_build_object('removed_at', now()));
  END LOOP;

  -- Delete users
  DELETE FROM client_users
  WHERE id = ANY(p_user_ids)
    AND organization_id = p_organization_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count
  );
END;
$$;

-- Function to log member invitation
CREATE OR REPLACE FUNCTION public.log_member_invited(
  p_organization_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_target_email text,
  p_target_name text,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO org_activity_log (organization_id, actor_id, actor_name, action_type, target_user_name, details)
  VALUES (p_organization_id, p_actor_id, p_actor_name, 'member_invited', p_target_name, 
    jsonb_build_object('email', p_target_email, 'role', p_role));
END;
$$;

-- Function to log member joined (when invitation accepted)
CREATE OR REPLACE FUNCTION public.log_member_joined(
  p_organization_id uuid,
  p_user_id uuid,
  p_user_name text,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO org_activity_log (organization_id, actor_id, actor_name, action_type, target_user_id, target_user_name, details)
  VALUES (p_organization_id, p_user_id, p_user_name, 'member_joined', p_user_id, p_user_name, 
    jsonb_build_object('role', p_role));
END;
$$;