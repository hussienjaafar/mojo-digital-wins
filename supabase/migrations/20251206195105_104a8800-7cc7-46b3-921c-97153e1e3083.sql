
-- ==========================================================
-- SECURITY PATCH: Fix all critical security findings
-- 1. profiles_table_public_exposure - Remove service role blanket access
-- 2. actblue_transactions_donor_pii - Add organization-scoped access
-- 3. admin_invite_codes_email_exposure - Restrict to creator only
-- ==========================================================

-- =====================================================
-- FIX 1: profiles table - Remove overly permissive service role access
-- =====================================================

-- Drop the dangerous service role policy that allows unrestricted access
DROP POLICY IF EXISTS "Service role can view all profiles" ON public.profiles;

-- Users can only view and update their own profile (keep existing)
-- The existing "Users can view own profile" policy already handles this

-- Create a secure profiles view for admin operations that masks email
CREATE OR REPLACE VIEW public.profiles_secure AS
SELECT 
  id,
  CASE 
    WHEN auth.uid() = id THEN email  -- Users see their own email
    WHEN has_role(auth.uid(), 'admin'::app_role) THEN email  -- Admins see emails
    ELSE CONCAT(LEFT(email, 2), '***@***', RIGHT(SPLIT_PART(email, '@', 2), 4))
  END as email,
  created_at,
  updated_at,
  last_sign_in_at,
  is_active,
  onboarding_completed,
  onboarding_completed_at
FROM public.profiles;

-- Grant access to the secure view
GRANT SELECT ON public.profiles_secure TO authenticated;

-- Revoke anon access
REVOKE ALL ON public.profiles_secure FROM anon;

-- =====================================================
-- FIX 2: actblue_transactions - Add organization-scoped access for admins
-- =====================================================

-- Create helper function to check if user is system admin (super admin without org restrictions)
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.client_users
    WHERE id = auth.uid()
  );
$$;

-- Create helper function to check if user can access organization data
CREATE OR REPLACE FUNCTION public.can_access_organization_data(_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Fail closed
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF _organization_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- System admins with no org assignment can see all (super admin)
  IF is_system_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Regular admins can only see their organization's data
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    SELECT organization_id INTO user_org_id
    FROM public.client_users
    WHERE id = auth.uid();
    
    IF user_org_id IS NOT NULL AND user_org_id = _organization_id THEN
      RETURN TRUE;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Drop existing policies on actblue_transactions
DROP POLICY IF EXISTS "actblue_select_system_admin_only" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_insert_admin_only" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_update_admin_only" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_delete_admin_only" ON public.actblue_transactions;

-- Create organization-scoped policies for actblue_transactions
CREATE POLICY "actblue_select_org_scoped" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (can_access_organization_data(organization_id));

CREATE POLICY "actblue_insert_org_scoped" ON public.actblue_transactions
FOR INSERT TO authenticated
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "actblue_update_org_scoped" ON public.actblue_transactions
FOR UPDATE TO authenticated
USING (can_access_organization_data(organization_id))
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "actblue_delete_org_scoped" ON public.actblue_transactions
FOR DELETE TO authenticated
USING (can_access_organization_data(organization_id));

-- Apply same fix to donor_demographics if it exists
DROP POLICY IF EXISTS "donor_demo_select_system_admin_only" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_demographics_select_system_admin_only" ON public.donor_demographics;

-- Check if table exists before creating policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'donor_demographics' AND table_schema = 'public') THEN
    -- Drop any existing policies
    DROP POLICY IF EXISTS "donor_select_org_scoped" ON public.donor_demographics;
    
    EXECUTE 'CREATE POLICY "donor_select_org_scoped" ON public.donor_demographics
    FOR SELECT TO authenticated
    USING (can_access_organization_data(organization_id))';
  END IF;
END $$;

-- =====================================================
-- FIX 3: admin_invite_codes - Restrict to creator only
-- =====================================================

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "invite_codes_admin_manage" ON public.admin_invite_codes;

-- Admins can only see invite codes they created
CREATE POLICY "invite_codes_select_own" ON public.admin_invite_codes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND created_by = auth.uid()
);

-- Admins can only create invite codes (as themselves)
CREATE POLICY "invite_codes_insert_own" ON public.admin_invite_codes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- Admins can only update their own invite codes
CREATE POLICY "invite_codes_update_own" ON public.admin_invite_codes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND created_by = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  AND created_by = auth.uid()
);

-- Admins can only delete their own invite codes
CREATE POLICY "invite_codes_delete_own" ON public.admin_invite_codes
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND created_by = auth.uid()
);

-- =====================================================
-- Additional: Drop dangerous service role policy on user_roles
-- =====================================================
DROP POLICY IF EXISTS "Service role can view all roles" ON public.user_roles;

-- =====================================================
-- Ensure RLS is enforced on all affected tables
-- =====================================================
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- Revoke anon access to sensitive tables
REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.admin_invite_codes FROM anon;
REVOKE ALL ON public.profiles FROM anon;
