
-- =====================================================
-- COMPLETE FIELD-LEVEL ACCESS CONTROLS WITH DATA MASKING
-- =====================================================

-- Step 1: Create helper function to check if user is org admin/manager
CREATE OR REPLACE FUNCTION public.is_org_admin_or_manager()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  );
END;
$$;

-- Step 2: Create a secure view for actblue_transactions with PII masking
CREATE OR REPLACE VIEW public.actblue_transactions_secure AS
SELECT 
  id,
  organization_id,
  transaction_id,
  transaction_date,
  amount,
  transaction_type,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN donor_email 
    ELSE CONCAT(LEFT(COALESCE(donor_email, ''), 2), '***@***.***')
  END AS donor_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN donor_name 
    ELSE CONCAT(LEFT(COALESCE(donor_name, ''), 1), '*** ***')
  END AS donor_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN first_name 
    ELSE CONCAT(LEFT(COALESCE(first_name, ''), 1), '***')
  END AS first_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN last_name 
    ELSE CONCAT(LEFT(COALESCE(last_name, ''), 1), '***')
  END AS last_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN phone 
    ELSE '***-***-****'
  END AS phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN addr1 
    ELSE '[Address Redacted]'
  END AS addr1,
  city,
  state,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN zip 
    ELSE CONCAT(LEFT(COALESCE(zip, ''), 3), '**')
  END AS zip,
  country,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN employer 
    ELSE '[Redacted]'
  END AS employer,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN occupation 
    ELSE '[Redacted]'
  END AS occupation,
  refcode,
  refcode2,
  refcode_custom,
  source_campaign,
  is_recurring,
  recurring_period,
  is_mobile,
  is_express,
  contribution_form,
  committee_name,
  entity_id,
  created_at
FROM public.actblue_transactions;

-- Step 3: Create a secure view for donor_demographics with PII masking
CREATE OR REPLACE VIEW public.donor_demographics_secure AS
SELECT 
  id,
  organization_id,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN donor_email 
    ELSE CONCAT(LEFT(COALESCE(donor_email, ''), 2), '***@***.***')
  END AS donor_email,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN first_name 
    ELSE CONCAT(LEFT(COALESCE(first_name, ''), 1), '***')
  END AS first_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN last_name 
    ELSE CONCAT(LEFT(COALESCE(last_name, ''), 1), '***')
  END AS last_name,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN phone 
    ELSE '***-***-****'
  END AS phone,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN address 
    ELSE '[Address Redacted]'
  END AS address,
  city,
  state,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN zip 
    ELSE CONCAT(LEFT(COALESCE(zip, ''), 3), '**')
  END AS zip,
  country,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN employer 
    ELSE '[Redacted]'
  END AS employer,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR is_org_admin_or_manager() 
    THEN occupation 
    ELSE '[Redacted]'
  END AS occupation,
  total_donated,
  donation_count,
  first_donation_date,
  last_donation_date,
  is_recurring,
  created_at,
  updated_at
FROM public.donor_demographics;

-- Step 4: Create secure view for audit logs
CREATE OR REPLACE VIEW public.admin_audit_logs_secure AS
SELECT 
  id,
  user_id,
  action_type,
  table_affected,
  record_id,
  old_value,
  new_value,
  created_at,
  CASE 
    WHEN user_id = auth.uid() 
    THEN ip_address 
    ELSE '[IP Redacted]'
  END AS ip_address,
  CASE 
    WHEN user_id = auth.uid() 
    THEN user_agent 
    ELSE '[User Agent Redacted]'
  END AS user_agent
FROM public.admin_audit_logs;

-- Step 5: Grant access to secure views
GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
GRANT SELECT ON public.donor_demographics_secure TO authenticated;
GRANT SELECT ON public.admin_audit_logs_secure TO authenticated;

-- Revoke anon access from all views
REVOKE ALL ON public.actblue_transactions_secure FROM anon;
REVOKE ALL ON public.donor_demographics_secure FROM anon;
REVOKE ALL ON public.admin_audit_logs_secure FROM anon;

-- Step 6: Set security_invoker on views so RLS from base tables applies
ALTER VIEW public.actblue_transactions_secure SET (security_invoker = true);
ALTER VIEW public.donor_demographics_secure SET (security_invoker = true);
ALTER VIEW public.admin_audit_logs_secure SET (security_invoker = true);

-- Step 7: Update RLS policies for base tables
DROP POLICY IF EXISTS "actblue_select_strict" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_select_admin_only" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_base_select_admin_or_org" ON public.actblue_transactions;

CREATE POLICY "actblue_select_org_access" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

DROP POLICY IF EXISTS "demographics_select_strict" ON public.donor_demographics;
DROP POLICY IF EXISTS "demographics_select_admin_only" ON public.donor_demographics;
DROP POLICY IF EXISTS "demographics_base_select_admin_or_org" ON public.donor_demographics;

CREATE POLICY "demographics_select_org_access" ON public.donor_demographics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- Step 8: Audit logs policies
DROP POLICY IF EXISTS "audit_logs_admin_only" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_service_only" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_only_select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_only_insert" ON public.admin_audit_logs;

CREATE POLICY "audit_logs_select_admin" ON public.admin_audit_logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "audit_logs_insert_admin" ON public.admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Step 9: Invite codes policies
DROP POLICY IF EXISTS "invite_codes_admin_only" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Only admins can manage invite codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Admins can manage invite codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "invite_codes_admin_only_all" ON public.admin_invite_codes;

CREATE POLICY "invite_codes_admin_manage" ON public.admin_invite_codes
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Step 10: Force RLS and revoke anon access on base tables
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_logs FROM anon;
REVOKE ALL ON public.admin_invite_codes FROM anon;
