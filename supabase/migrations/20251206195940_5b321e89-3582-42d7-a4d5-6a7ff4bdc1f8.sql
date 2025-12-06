
-- ==========================================================
-- COMPREHENSIVE PII PROTECTION PATCH (FIXED)
-- Defense-in-depth security for all tables containing PII
-- ==========================================================

-- =====================================================
-- PART 1: Create secure access functions
-- =====================================================

-- Function to check if user has privileged PII access (admin + org admin/manager)
CREATE OR REPLACE FUNCTION public.has_pii_access()
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
  
  -- System admins have full PII access
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN TRUE;
  END IF;
  
  -- Organization admins/managers have PII access for their org
  RETURN EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'manager')
  );
END;
$$;

-- Function to mask email addresses
CREATE OR REPLACE FUNCTION public.mask_email(email_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF email_input IS NULL OR email_input = '' THEN
    RETURN NULL;
  END IF;
  RETURN CONCAT(
    LEFT(SPLIT_PART(email_input, '@', 1), 2),
    '***@***.',
    RIGHT(SPLIT_PART(email_input, '@', 2), 3)
  );
END;
$$;

-- Function to mask phone numbers
CREATE OR REPLACE FUNCTION public.mask_phone(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  RETURN CONCAT('***-***-', RIGHT(REGEXP_REPLACE(phone_input, '[^0-9]', '', 'g'), 4));
END;
$$;

-- Function to mask names (show first initial only)
CREATE OR REPLACE FUNCTION public.mask_name(name_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF name_input IS NULL OR name_input = '' THEN
    RETURN NULL;
  END IF;
  RETURN CONCAT(LEFT(name_input, 1), '***');
END;
$$;

-- Function to mask addresses
CREATE OR REPLACE FUNCTION public.mask_address(address_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF address_input IS NULL OR address_input = '' THEN
    RETURN NULL;
  END IF;
  RETURN '*** [Address Hidden]';
END;
$$;

-- =====================================================
-- PART 2: Recreate actblue_transactions_secure with proper masking
-- =====================================================

DROP VIEW IF EXISTS public.actblue_transactions_secure CASCADE;

CREATE VIEW public.actblue_transactions_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  organization_id,
  transaction_date,
  amount,
  is_recurring,
  transaction_id,
  transaction_type,
  -- Apply masking based on user privilege level
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN donor_name ELSE mask_name(donor_name) END as donor_name,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN first_name ELSE mask_name(first_name) END as first_name,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN last_name ELSE mask_name(last_name) END as last_name,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN donor_email ELSE mask_email(donor_email) END as donor_email,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN phone ELSE mask_phone(phone) END as phone,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN addr1 ELSE mask_address(addr1) END as addr1,
  city,
  state,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN zip ELSE LEFT(COALESCE(zip, ''), 3) || '**' END as zip,
  country,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN employer ELSE '*** [Hidden]' END as employer,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN occupation ELSE '*** [Hidden]' END as occupation,
  refcode,
  source_campaign,
  created_at
FROM public.actblue_transactions;

GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
REVOKE ALL ON public.actblue_transactions_secure FROM anon;

-- =====================================================
-- PART 3: Create donor_demographics_secure view (with correct columns)
-- =====================================================

DROP VIEW IF EXISTS public.donor_demographics_secure CASCADE;

CREATE VIEW public.donor_demographics_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  organization_id,
  -- Apply masking based on user privilege level
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN donor_email ELSE mask_email(donor_email) END as donor_email,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN first_name ELSE mask_name(first_name) END as first_name,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN last_name ELSE mask_name(last_name) END as last_name,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN phone ELSE mask_phone(phone) END as phone,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN address ELSE mask_address(address) END as address,
  city,
  state,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN zip ELSE LEFT(COALESCE(zip, ''), 3) || '**' END as zip,
  country,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN employer ELSE '*** [Hidden]' END as employer,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN occupation ELSE '*** [Hidden]' END as occupation,
  -- Non-PII fields (using correct column names)
  total_donated,
  first_donation_date,
  last_donation_date,
  donation_count,
  is_recurring,
  party_affiliation,
  voter_score,
  age,
  gender,
  voter_file_matched,
  created_at,
  updated_at
FROM public.donor_demographics;

GRANT SELECT ON public.donor_demographics_secure TO authenticated;
REVOKE ALL ON public.donor_demographics_secure FROM anon;

-- =====================================================
-- PART 4: Restrict base table access - privileged users only
-- =====================================================

-- actblue_transactions: Only privileged users can access base table
DROP POLICY IF EXISTS "actblue_select_authenticated" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_insert_authenticated" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_update_authenticated" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_delete_authenticated" ON public.actblue_transactions;

CREATE POLICY "actblue_base_select" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (
  has_pii_access() AND can_access_organization_data(organization_id)
);

CREATE POLICY "actblue_base_insert" ON public.actblue_transactions
FOR INSERT TO authenticated
WITH CHECK (
  has_pii_access() AND can_access_organization_data(organization_id)
);

CREATE POLICY "actblue_base_update" ON public.actblue_transactions
FOR UPDATE TO authenticated
USING (has_pii_access() AND can_access_organization_data(organization_id))
WITH CHECK (has_pii_access() AND can_access_organization_data(organization_id));

CREATE POLICY "actblue_base_delete" ON public.actblue_transactions
FOR DELETE TO authenticated
USING (has_pii_access() AND can_access_organization_data(organization_id));

-- donor_demographics: Same pattern
DROP POLICY IF EXISTS "donor_demographics_select" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_demographics_insert" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_demographics_update" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_demographics_delete" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_base_select" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_base_insert" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_base_update" ON public.donor_demographics;
DROP POLICY IF EXISTS "donor_base_delete" ON public.donor_demographics;

CREATE POLICY "donor_base_select" ON public.donor_demographics
FOR SELECT TO authenticated
USING (
  has_pii_access() AND can_access_organization_data(organization_id)
);

CREATE POLICY "donor_base_insert" ON public.donor_demographics
FOR INSERT TO authenticated
WITH CHECK (
  has_pii_access() AND can_access_organization_data(organization_id)
);

CREATE POLICY "donor_base_update" ON public.donor_demographics
FOR UPDATE TO authenticated
USING (has_pii_access() AND can_access_organization_data(organization_id))
WITH CHECK (has_pii_access() AND can_access_organization_data(organization_id));

CREATE POLICY "donor_base_delete" ON public.donor_demographics
FOR DELETE TO authenticated
USING (has_pii_access() AND can_access_organization_data(organization_id));

-- =====================================================
-- PART 5: Admin invite codes - auto cleanup and masking
-- =====================================================

-- Create function to auto-cleanup expired invite codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_invite_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clear email addresses from expired invitations
  UPDATE public.admin_invite_codes
  SET email_sent_to = NULL
  WHERE expires_at < NOW()
    AND is_active = true
    AND used_at IS NULL;
  
  -- Deactivate expired codes
  UPDATE public.admin_invite_codes
  SET is_active = false
  WHERE expires_at < NOW()
    AND is_active = true
    AND used_at IS NULL;
END;
$$;

-- Create secure view for admin invite codes
DROP VIEW IF EXISTS public.admin_invite_codes_secure CASCADE;

CREATE VIEW public.admin_invite_codes_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  code,
  created_at,
  created_by,
  used_at,
  used_by,
  is_active,
  expires_at,
  -- Only show email to the creator
  CASE WHEN auth.uid() = created_by 
       THEN email_sent_to 
       ELSE mask_email(email_sent_to) END as email_sent_to,
  email_status,
  email_sent_at,
  CASE WHEN auth.uid() = created_by 
       THEN email_error 
       ELSE NULL END as email_error,
  resend_count
FROM public.admin_invite_codes
WHERE created_by = auth.uid();

GRANT SELECT ON public.admin_invite_codes_secure TO authenticated;
REVOKE ALL ON public.admin_invite_codes_secure FROM anon;

-- =====================================================
-- PART 6: Other tables with PII - add protection
-- =====================================================

-- login_history: Already restricted to admins, add IP masking
DROP VIEW IF EXISTS public.login_history_secure CASCADE;

CREATE VIEW public.login_history_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) 
       THEN email ELSE mask_email(email) END as email,
  login_successful,
  failure_reason,
  -- Mask IP for non-admins
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) 
       THEN ip_address ELSE '***.***.***' END as ip_address,
  user_agent,
  created_at
FROM public.login_history;

GRANT SELECT ON public.login_history_secure TO authenticated;
REVOKE ALL ON public.login_history_secure FROM anon;

-- attribution_touchpoints: mask donor_email
DROP VIEW IF EXISTS public.attribution_touchpoints_secure CASCADE;

CREATE VIEW public.attribution_touchpoints_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  organization_id,
  touchpoint_type,
  occurred_at,
  CASE WHEN has_pii_access() AND can_access_organization_data(organization_id) 
       THEN donor_email ELSE mask_email(donor_email) END as donor_email,
  campaign_id,
  refcode,
  utm_source,
  utm_medium,
  utm_campaign,
  metadata,
  created_at
FROM public.attribution_touchpoints;

GRANT SELECT ON public.attribution_touchpoints_secure TO authenticated;
REVOKE ALL ON public.attribution_touchpoints_secure FROM anon;

-- contact_submissions: Only admins can view, mask for extra safety
DROP VIEW IF EXISTS public.contact_submissions_secure CASCADE;

CREATE VIEW public.contact_submissions_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  created_at,
  updated_at,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) 
       THEN name ELSE mask_name(name) END as name,
  CASE WHEN has_role(auth.uid(), 'admin'::app_role) 
       THEN email ELSE mask_email(email) END as email,
  campaign,
  organization_type,
  message,
  status,
  priority,
  assigned_to,
  resolved_at
FROM public.contact_submissions;

GRANT SELECT ON public.contact_submissions_secure TO authenticated;
REVOKE ALL ON public.contact_submissions_secure FROM anon;

-- profiles: mask email for non-owners/non-admins
DROP VIEW IF EXISTS public.profiles_secure CASCADE;

CREATE VIEW public.profiles_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  CASE WHEN auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role) 
       THEN email ELSE mask_email(email) END as email,
  created_at,
  updated_at,
  last_sign_in_at,
  is_active,
  onboarding_completed,
  onboarding_completed_at
FROM public.profiles;

GRANT SELECT ON public.profiles_secure TO authenticated;
REVOKE ALL ON public.profiles_secure FROM anon;

-- admin_audit_logs_secure: mask sensitive fields
DROP VIEW IF EXISTS public.admin_audit_logs_secure CASCADE;

CREATE VIEW public.admin_audit_logs_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  action_type,
  table_affected,
  record_id,
  -- Mask IP unless user is viewing their own logs
  CASE WHEN auth.uid() = user_id THEN ip_address ELSE '***.***.***' END as ip_address,
  CASE WHEN auth.uid() = user_id THEN user_agent ELSE '*** [Hidden]' END as user_agent,
  old_value,
  new_value,
  created_at
FROM public.admin_audit_logs;

GRANT SELECT ON public.admin_audit_logs_secure TO authenticated;
REVOKE ALL ON public.admin_audit_logs_secure FROM anon;

-- =====================================================
-- PART 7: Force RLS on all sensitive tables
-- =====================================================

ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Revoke all anon access
REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.donor_demographics FROM anon;
REVOKE ALL ON public.admin_invite_codes FROM anon;
REVOKE ALL ON public.login_history FROM anon;
REVOKE ALL ON public.attribution_touchpoints FROM anon;
REVOKE ALL ON public.contact_submissions FROM anon;
REVOKE ALL ON public.profiles FROM anon;
