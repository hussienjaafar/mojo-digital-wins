
-- =====================================================
-- COMPREHENSIVE SECURITY PATCH
-- =====================================================
-- Fixes:
-- 1. actblue_transactions - Restrict to org admins/managers only (not all org members)
-- 2. admin_audit_logs - Remove user INSERT, make system-managed via trigger
-- 3. login_history - Remove user INSERT, make system-managed
-- 4. contact_submissions - Strengthen rate limiting
-- =====================================================

-- ===========================================
-- FIX 1: ACTBLUE_TRANSACTIONS - Restrict to privileged users only
-- ===========================================
-- Only org admins/managers should access donor PII, not all org members

DROP POLICY IF EXISTS "actblue_select_org_access" ON public.actblue_transactions;

-- New policy: Only system admins OR org admins/managers can view transactions
CREATE POLICY "actblue_select_privileged_only" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (
  -- System-wide admins
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  -- Org admins/managers only (not regular org members)
  (
    user_belongs_to_organization(organization_id) 
    AND is_org_admin_or_manager()
  )
);

-- Update secure view to also enforce privileged access
DROP VIEW IF EXISTS public.actblue_transactions_secure;
CREATE VIEW public.actblue_transactions_secure AS
SELECT 
  id,
  organization_id,
  transaction_id,
  transaction_date,
  amount,
  transaction_type,
  -- All PII masked - only aggregate data visible in view
  CONCAT(LEFT(COALESCE(donor_email, ''), 2), '***@***.***') AS donor_email,
  CONCAT(LEFT(COALESCE(donor_name, ''), 1), '*** ***') AS donor_name,
  CONCAT(LEFT(COALESCE(first_name, ''), 1), '***') AS first_name,
  CONCAT(LEFT(COALESCE(last_name, ''), 1), '***') AS last_name,
  '***-***-****' AS phone,
  '[Address Redacted]' AS addr1,
  city,
  state,
  CONCAT(LEFT(COALESCE(zip, ''), 3), '**') AS zip,
  country,
  '[Redacted]' AS employer,
  '[Redacted]' AS occupation,
  refcode,
  source_campaign,
  is_recurring,
  created_at
FROM public.actblue_transactions;

GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
REVOKE ALL ON public.actblue_transactions_secure FROM anon;
ALTER VIEW public.actblue_transactions_secure SET (security_invoker = true);

-- ===========================================
-- FIX 2: ADMIN_AUDIT_LOGS - Make system-managed only
-- ===========================================
-- Remove all INSERT policies from authenticated users
-- Logs should only be created by database triggers/functions

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Only admins can insert audit logs" ON public.admin_audit_logs;

-- Create a new INSERT policy that DENIES all direct inserts
-- Only service_role can insert (via triggers/functions)
CREATE POLICY "audit_logs_system_insert_only" ON public.admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (false); -- Always deny direct inserts from users

-- Revoke INSERT privilege from authenticated role (defense in depth)
REVOKE INSERT ON public.admin_audit_logs FROM authenticated;

-- Grant INSERT only to service_role (already has it by default)
-- The log_admin_action() function runs as SECURITY DEFINER and can still insert

-- ===========================================
-- FIX 3: LOGIN_HISTORY - Make system-managed only
-- ===========================================
DROP POLICY IF EXISTS "Only system functions can insert login history" ON public.login_history;

-- Deny direct inserts from all users
CREATE POLICY "login_history_system_insert_only" ON public.login_history
FOR INSERT TO authenticated
WITH CHECK (false); -- Always deny direct inserts

-- Revoke INSERT from authenticated
REVOKE INSERT ON public.login_history FROM authenticated;

-- The log_login_attempt() function runs as SECURITY DEFINER and can still insert

-- ===========================================
-- FIX 4: CONTACT_SUBMISSIONS - Strengthen protection
-- ===========================================
-- Keep rate limiting but add additional checks

-- First, improve the rate limit function with more restrictions
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
  very_recent_count integer;
BEGIN
  -- Hard limit: max 50 submissions per hour globally
  SELECT COUNT(*) INTO recent_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_count >= 50 THEN
    RETURN false;
  END IF;
  
  -- Burst protection: max 5 per minute
  SELECT COUNT(*) INTO very_recent_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '1 minute';
  
  IF very_recent_count >= 5 THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Clean up duplicate policies
DROP POLICY IF EXISTS "Only admins can delete submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can manage contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can update submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can view contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Only admins can view submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Rate limited contact form submissions" ON public.contact_submissions;

-- Recreate clean policies
CREATE POLICY "contact_admin_manage" ON public.contact_submissions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "contact_rate_limited_insert" ON public.contact_submissions
FOR INSERT TO anon
WITH CHECK (check_contact_rate_limit());

-- ===========================================
-- FIX 5: DONOR_DEMOGRAPHICS - Same privileged access restriction
-- ===========================================
DROP POLICY IF EXISTS "demographics_select_org_access" ON public.donor_demographics;

CREATE POLICY "demographics_select_privileged_only" ON public.donor_demographics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (
    user_belongs_to_organization(organization_id) 
    AND is_org_admin_or_manager()
  )
);

-- ===========================================
-- Ensure RLS is forced on all tables
-- ===========================================
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- Revoke anon from all sensitive tables
REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.donor_demographics FROM anon;
REVOKE ALL ON public.admin_audit_logs FROM anon;
REVOKE ALL ON public.login_history FROM anon;
