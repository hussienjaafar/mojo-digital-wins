
-- =====================================================
-- FINAL SECURITY HARDENING
-- =====================================================

-- ===========================================
-- FIX 1: ACTBLUE_TRANSACTIONS - System admins only for base table
-- ===========================================
-- Remove org manager access to base table with full PII
-- They must use the secure view with masked data

DROP POLICY IF EXISTS "actblue_select_privileged_only" ON public.actblue_transactions;

-- ONLY system admins can access the base table with full PII
CREATE POLICY "actblue_select_system_admin_only" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update the secure view to be the ONLY way non-admins access data
-- This view has ALL PII masked
DROP VIEW IF EXISTS public.actblue_transactions_secure;
CREATE VIEW public.actblue_transactions_secure AS
SELECT 
  id,
  organization_id,
  transaction_id,
  transaction_date,
  amount,
  transaction_type,
  -- ALL PII is masked - no exceptions
  '***@***.***' AS donor_email,
  '*** ***' AS donor_name,
  '***' AS first_name,
  '***' AS last_name,
  '***-***-****' AS phone,
  '[Redacted]' AS addr1,
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

-- RLS for the view - org members can only see their org's masked data
GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
REVOKE ALL ON public.actblue_transactions_secure FROM anon;
ALTER VIEW public.actblue_transactions_secure SET (security_invoker = true);

-- ===========================================
-- FIX 2: DONOR_DEMOGRAPHICS - Same restriction
-- ===========================================
DROP POLICY IF EXISTS "demographics_select_privileged_only" ON public.donor_demographics;

CREATE POLICY "demographics_select_system_admin_only" ON public.donor_demographics
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ===========================================
-- FIX 3: ADMIN_AUDIT_LOGS - Mask sensitive fields before storage
-- ===========================================

-- Create function to mask sensitive data in audit logs
CREATE OR REPLACE FUNCTION public.mask_audit_sensitive_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sensitive_keys TEXT[] := ARRAY[
    'password', 'secret', 'token', 'api_key', 'apikey', 'access_token',
    'refresh_token', 'private_key', 'credentials', 'encrypted_credentials',
    'donor_email', 'phone', 'addr1', 'address', 'ssn', 'credit_card'
  ];
  key TEXT;
BEGIN
  -- Mask sensitive fields in old_value
  IF NEW.old_value IS NOT NULL THEN
    FOREACH key IN ARRAY sensitive_keys
    LOOP
      IF NEW.old_value ? key THEN
        NEW.old_value := NEW.old_value || jsonb_build_object(key, '[REDACTED]');
      END IF;
    END LOOP;
  END IF;
  
  -- Mask sensitive fields in new_value
  IF NEW.new_value IS NOT NULL THEN
    FOREACH key IN ARRAY sensitive_keys
    LOOP
      IF NEW.new_value ? key THEN
        NEW.new_value := NEW.new_value || jsonb_build_object(key, '[REDACTED]');
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically mask data on insert
DROP TRIGGER IF EXISTS mask_audit_data_trigger ON public.admin_audit_logs;
CREATE TRIGGER mask_audit_data_trigger
BEFORE INSERT ON public.admin_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.mask_audit_sensitive_data();

-- ===========================================
-- FIX 4: CONTACT_SUBMISSIONS - Add failsafe rate limiting
-- ===========================================

-- Update rate limit function with additional safeguards
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_count integer;
  minute_count integer;
  daily_count integer;
BEGIN
  -- Daily limit: 200 max per day
  SELECT COUNT(*) INTO daily_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  IF daily_count >= 200 THEN
    RETURN false;
  END IF;
  
  -- Hourly limit: 30 max per hour  
  SELECT COUNT(*) INTO hourly_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  IF hourly_count >= 30 THEN
    RETURN false;
  END IF;
  
  -- Burst limit: 3 per minute
  SELECT COUNT(*) INTO minute_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '1 minute';
  
  IF minute_count >= 3 THEN
    RETURN false;
  END IF;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Fail closed on any error
    RETURN false;
END;
$$;

-- Ensure rate limit policy is properly set
DROP POLICY IF EXISTS "contact_rate_limited_insert" ON public.contact_submissions;
CREATE POLICY "contact_failsafe_rate_limited_insert" ON public.contact_submissions
FOR INSERT TO anon
WITH CHECK (check_contact_rate_limit());

-- ===========================================
-- Ensure RLS is forced on all sensitive tables
-- ===========================================
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;
