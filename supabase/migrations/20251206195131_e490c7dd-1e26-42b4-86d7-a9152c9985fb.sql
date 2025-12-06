
-- Fix SECURITY DEFINER view warning by using SECURITY INVOKER instead
-- The profiles_secure view should use invoker security to respect RLS

-- Drop and recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure 
WITH (security_invoker = true)
AS
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

-- Also fix any other secure views that might have this issue
DROP VIEW IF EXISTS public.actblue_transactions_secure;

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
  -- Always mask PII fields for security
  '***' as donor_name,
  '***' as first_name,
  '***' as last_name,
  '***@***' as donor_email,
  '***' as phone,
  '***' as addr1,
  '***' as city,
  state,
  '***' as zip,
  country,
  '***' as employer,
  '***' as occupation,
  refcode,
  source_campaign,
  created_at
FROM public.actblue_transactions;

GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
REVOKE ALL ON public.actblue_transactions_secure FROM anon;

-- Fix donor_demographics_secure if it exists
DROP VIEW IF EXISTS public.donor_demographics_secure;

-- Fix admin_audit_logs_secure if it exists
DROP VIEW IF EXISTS public.admin_audit_logs_secure;

CREATE VIEW public.admin_audit_logs_secure
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  action_type,
  table_affected,
  record_id,
  -- Mask sensitive data unless user is viewing their own logs
  CASE 
    WHEN auth.uid() = user_id THEN ip_address 
    ELSE '***.***.***' 
  END as ip_address,
  CASE 
    WHEN auth.uid() = user_id THEN user_agent 
    ELSE '***' 
  END as user_agent,
  old_value,
  new_value,
  created_at
FROM public.admin_audit_logs;

GRANT SELECT ON public.admin_audit_logs_secure TO authenticated;
REVOKE ALL ON public.admin_audit_logs_secure FROM anon;
