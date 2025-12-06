
-- ==========================================================
-- COMPREHENSIVE SECURITY PATCH: Fix all public exposure issues
-- The problem: Policies using 'public' role allow anon access
-- Solution: Use 'authenticated' only + FORCE RLS + REVOKE anon
-- ==========================================================

-- =====================================================
-- FIX 1: actblue_transactions - Ensure no anon access
-- =====================================================

-- Drop and recreate policies with authenticated role only
DROP POLICY IF EXISTS "actblue_select_org_scoped" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_insert_org_scoped" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_update_org_scoped" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_delete_org_scoped" ON public.actblue_transactions;

-- Create strict policies for authenticated users only
CREATE POLICY "actblue_select_authenticated" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (can_access_organization_data(organization_id));

CREATE POLICY "actblue_insert_authenticated" ON public.actblue_transactions
FOR INSERT TO authenticated
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "actblue_update_authenticated" ON public.actblue_transactions
FOR UPDATE TO authenticated
USING (can_access_organization_data(organization_id))
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "actblue_delete_authenticated" ON public.actblue_transactions
FOR DELETE TO authenticated
USING (can_access_organization_data(organization_id));

-- Force RLS and revoke anon access
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.actblue_transactions FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actblue_transactions TO authenticated;

-- =====================================================
-- FIX 2: admin_audit_logs - Admin-only access
-- =====================================================

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_system_insert_only" ON public.admin_audit_logs;

-- Only admins can read audit logs
CREATE POLICY "audit_logs_admin_select" ON public.admin_audit_logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only system can insert (via security definer functions)
-- No direct insert allowed - use log_admin_action() function instead
CREATE POLICY "audit_logs_no_direct_insert" ON public.admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (false);  -- Block direct inserts, use log_admin_action() instead

ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM anon;
REVOKE ALL ON public.admin_audit_logs FROM public;
GRANT SELECT ON public.admin_audit_logs TO authenticated;

-- =====================================================
-- FIX 3: admin_invite_codes - Creator-only access
-- =====================================================

DROP POLICY IF EXISTS "invite_codes_select_own" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "invite_codes_insert_own" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "invite_codes_update_own" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "invite_codes_delete_own" ON public.admin_invite_codes;

-- Admins can only see codes they created
CREATE POLICY "invite_select_creator_only" ON public.admin_invite_codes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND created_by = auth.uid()
);

CREATE POLICY "invite_insert_admin" ON public.admin_invite_codes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND created_by = auth.uid()
);

CREATE POLICY "invite_update_creator_only" ON public.admin_invite_codes
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "invite_delete_creator_only" ON public.admin_invite_codes
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_invite_codes FROM anon;
REVOKE ALL ON public.admin_invite_codes FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invite_codes TO authenticated;

-- =====================================================
-- FIX 4: meta_ad_metrics - Organization-scoped access only
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage all metrics" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "Users can view own org metrics" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "meta_metrics_admin_write" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "meta_metrics_select_strict" ON public.meta_ad_metrics;

-- Select: organization members or system admins only
CREATE POLICY "meta_select_org_scoped" ON public.meta_ad_metrics
FOR SELECT TO authenticated
USING (can_access_organization_data(organization_id));

-- Insert/Update/Delete: organization admins or system admins
CREATE POLICY "meta_insert_org_scoped" ON public.meta_ad_metrics
FOR INSERT TO authenticated
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "meta_update_org_scoped" ON public.meta_ad_metrics
FOR UPDATE TO authenticated
USING (can_access_organization_data(organization_id))
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "meta_delete_org_scoped" ON public.meta_ad_metrics
FOR DELETE TO authenticated
USING (can_access_organization_data(organization_id));

ALTER TABLE public.meta_ad_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_ad_metrics FROM anon;
REVOKE ALL ON public.meta_ad_metrics FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_metrics TO authenticated;

-- =====================================================
-- FIX 5: admin_activity_alerts - Admin-only access
-- =====================================================

DROP POLICY IF EXISTS "Admins manage activity alerts" ON public.admin_activity_alerts;

CREATE POLICY "activity_alerts_admin_select" ON public.admin_activity_alerts
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "activity_alerts_admin_insert" ON public.admin_activity_alerts
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "activity_alerts_admin_update" ON public.admin_activity_alerts
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "activity_alerts_admin_delete" ON public.admin_activity_alerts
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.admin_activity_alerts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_activity_alerts FROM anon;
REVOKE ALL ON public.admin_activity_alerts FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_activity_alerts TO authenticated;

-- =====================================================
-- FIX 6: donor_demographics - Same as actblue_transactions
-- =====================================================

DROP POLICY IF EXISTS "donor_select_org_scoped" ON public.donor_demographics;

CREATE POLICY "donor_demographics_select" ON public.donor_demographics
FOR SELECT TO authenticated
USING (can_access_organization_data(organization_id));

CREATE POLICY "donor_demographics_insert" ON public.donor_demographics
FOR INSERT TO authenticated
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "donor_demographics_update" ON public.donor_demographics
FOR UPDATE TO authenticated
USING (can_access_organization_data(organization_id))
WITH CHECK (can_access_organization_data(organization_id));

CREATE POLICY "donor_demographics_delete" ON public.donor_demographics
FOR DELETE TO authenticated
USING (can_access_organization_data(organization_id));

ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.donor_demographics FROM anon;
REVOKE ALL ON public.donor_demographics FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donor_demographics TO authenticated;

-- =====================================================
-- FIX 7: login_history - System-managed only
-- =====================================================

DROP POLICY IF EXISTS "login_history_system_insert_only" ON public.login_history;
DROP POLICY IF EXISTS "login_history_select_admin" ON public.login_history;

-- Only admins can view login history
CREATE POLICY "login_history_admin_view" ON public.login_history
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- No direct inserts - use log_login_attempt() function
CREATE POLICY "login_history_no_direct_insert" ON public.login_history
FOR INSERT TO authenticated
WITH CHECK (false);

ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_history FROM anon;
REVOKE ALL ON public.login_history FROM public;
GRANT SELECT ON public.login_history TO authenticated;

-- =====================================================
-- FIX 8: Ensure other sensitive tables are secured
-- =====================================================

-- profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_admin_select" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_admin_update" ON public.profiles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM public;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- user_roles table
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "user_roles_view_own" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "user_roles_admin_all" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
