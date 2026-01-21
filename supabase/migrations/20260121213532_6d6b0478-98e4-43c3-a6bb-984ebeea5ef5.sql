-- Add seat limit tracking to client_organizations
ALTER TABLE client_organizations
ADD COLUMN seat_limit integer NOT NULL DEFAULT 5;

-- Create seat_requests table for organizations to request more seats
CREATE TABLE seat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES client_organizations(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid NOT NULL,
  requested_seats integer NOT NULL,
  current_seat_limit integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create pending_member_requests table for org admins to request new members
CREATE TABLE pending_member_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES client_organizations(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  requested_role text NOT NULL DEFAULT 'viewer' CHECK (requested_role IN ('admin', 'manager', 'viewer')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE seat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_member_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for seat_requests

-- Platform admins can view all seat requests
CREATE POLICY "Platform admins can view all seat requests"
ON seat_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Org admins/managers can view their own org's seat requests
CREATE POLICY "Org members can view their org seat requests"
ON seat_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_users
    WHERE client_users.id = auth.uid()
    AND client_users.organization_id = seat_requests.organization_id
    AND client_users.role IN ('admin', 'manager')
  )
);

-- Org admins can create seat requests for their org
CREATE POLICY "Org admins can create seat requests"
ON seat_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM client_users
    WHERE client_users.id = auth.uid()
    AND client_users.organization_id = seat_requests.organization_id
    AND client_users.role = 'admin'
  )
);

-- Platform admins can update seat requests (approve/reject)
CREATE POLICY "Platform admins can update seat requests"
ON seat_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- RLS policies for pending_member_requests

-- Platform admins can view all pending member requests
CREATE POLICY "Platform admins can view all pending member requests"
ON pending_member_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Org admins/managers can view their org's pending member requests
CREATE POLICY "Org members can view their org pending member requests"
ON pending_member_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_users
    WHERE client_users.id = auth.uid()
    AND client_users.organization_id = pending_member_requests.organization_id
    AND client_users.role IN ('admin', 'manager')
  )
);

-- Org admins/managers can create pending member requests for their org
CREATE POLICY "Org admins can create pending member requests"
ON pending_member_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM client_users
    WHERE client_users.id = auth.uid()
    AND client_users.organization_id = pending_member_requests.organization_id
    AND client_users.role IN ('admin', 'manager')
  )
);

-- Platform admins can update pending member requests (approve/reject)
CREATE POLICY "Platform admins can update pending member requests"
ON pending_member_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Platform admins can delete pending member requests
CREATE POLICY "Platform admins can delete pending member requests"
ON pending_member_requests FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create function to get seat usage for an organization
CREATE OR REPLACE FUNCTION get_org_seat_usage(org_id uuid)
RETURNS TABLE(
  seat_limit integer,
  members_count bigint,
  pending_invites_count bigint,
  pending_requests_count bigint,
  total_used bigint,
  available_seats bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    co.seat_limit,
    (SELECT COUNT(*) FROM client_users cu WHERE cu.organization_id = org_id) as members_count,
    (SELECT COUNT(*) FROM user_invitations ui 
     WHERE ui.organization_id = org_id 
     AND ui.status = 'pending' 
     AND ui.invitation_type = 'organization_member') as pending_invites_count,
    (SELECT COUNT(*) FROM pending_member_requests pmr 
     WHERE pmr.organization_id = org_id 
     AND pmr.status = 'pending') as pending_requests_count,
    (SELECT COUNT(*) FROM client_users cu WHERE cu.organization_id = org_id) +
    (SELECT COUNT(*) FROM user_invitations ui 
     WHERE ui.organization_id = org_id 
     AND ui.status = 'pending' 
     AND ui.invitation_type = 'organization_member') as total_used,
    co.seat_limit - (
      (SELECT COUNT(*) FROM client_users cu WHERE cu.organization_id = org_id) +
      (SELECT COUNT(*) FROM user_invitations ui 
       WHERE ui.organization_id = org_id 
       AND ui.status = 'pending' 
       AND ui.invitation_type = 'organization_member')
    ) as available_seats
  FROM client_organizations co
  WHERE co.id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_seat_requests_updated_at
BEFORE UPDATE ON seat_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_member_requests_updated_at
BEFORE UPDATE ON pending_member_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();