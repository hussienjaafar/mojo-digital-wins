-- Fix infinite recursion in organization_memberships RLS policies
-- The issue: policies query organization_memberships from within organization_memberships policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Org admins can view all org members" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Org admins can invite members" ON organization_memberships;
DROP POLICY IF EXISTS "Org admins can update memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Org owners can remove members" ON organization_memberships;

-- Create a security definer function that can check membership without triggering RLS
CREATE OR REPLACE FUNCTION public.check_org_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_roles text[] DEFAULT ARRAY['owner', 'admin', 'manager', 'member']
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND role = ANY(p_roles)
      AND status = 'active'
  );
$$;

-- Recreate policies using the helper function

-- SELECT: Users can see their own memberships OR all memberships in orgs where they're admin+
CREATE POLICY "Users can view org memberships"
ON organization_memberships
FOR SELECT
USING (
  user_id = auth.uid()
  OR 
  public.check_org_membership(organization_id, auth.uid(), ARRAY['owner', 'admin', 'manager'])
);

-- INSERT: Org admins can invite, or user creating their own membership
CREATE POLICY "Admins can add members"
ON organization_memberships
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR
  public.check_org_membership(organization_id, auth.uid(), ARRAY['owner', 'admin', 'manager'])
);

-- UPDATE: User can update own membership OR org admins can update
CREATE POLICY "Members and admins can update"
ON organization_memberships
FOR UPDATE
USING (
  user_id = auth.uid()
  OR
  public.check_org_membership(organization_id, auth.uid(), ARRAY['owner', 'admin'])
);

-- DELETE: User can leave OR owners can remove
CREATE POLICY "Owners can remove members"
ON organization_memberships
FOR DELETE
USING (
  user_id = auth.uid()
  OR
  public.check_org_membership(organization_id, auth.uid(), ARRAY['owner'])
);