
-- Fix transaction_attribution security
-- 1. Require PII access for SELECT (contains donor_email)
-- 2. Create secure view with hashed emails
-- 3. Revoke anon/public access

-- Drop existing policies
DROP POLICY IF EXISTS "Organization members can view their attribution" ON public.transaction_attribution;
DROP POLICY IF EXISTS "Only admins can insert attribution" ON public.transaction_attribution;
DROP POLICY IF EXISTS "Only admins can update attribution" ON public.transaction_attribution;
DROP POLICY IF EXISTS "Only admins can delete attribution" ON public.transaction_attribution;

-- Create stricter policies requiring PII access
CREATE POLICY "tx_attr_select_pii" ON public.transaction_attribution
  FOR SELECT TO authenticated
  USING (
    has_pii_access() AND (
      has_role(auth.uid(), 'admin'::app_role) OR 
      user_belongs_to_organization(organization_id)
    )
  );

CREATE POLICY "tx_attr_insert_admin" ON public.transaction_attribution
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tx_attr_update_admin" ON public.transaction_attribution
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "tx_attr_delete_admin" ON public.transaction_attribution
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Force RLS and revoke anon/public
ALTER TABLE public.transaction_attribution FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.transaction_attribution FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_attribution TO authenticated;

-- Create secure view with hashed donor_email for analytics users
DROP VIEW IF EXISTS public.transaction_attribution_secure;
CREATE VIEW public.transaction_attribution_secure
WITH (security_invoker = true)
AS SELECT
  id,
  transaction_id,
  organization_id,
  -- Hash donor_email for non-PII users, show full for PII users
  CASE 
    WHEN has_pii_access() THEN donor_email
    ELSE CONCAT('donor_', encode(sha256(COALESCE(donor_email, '')::bytea), 'hex')::text)
  END as donor_email,
  first_touch_channel,
  first_touch_campaign,
  first_touch_weight,
  last_touch_channel,
  last_touch_campaign,
  last_touch_weight,
  middle_touches,
  middle_touches_weight,
  total_touchpoints,
  attribution_calculated_at,
  created_at
FROM public.transaction_attribution;

-- Secure the view
REVOKE ALL ON public.transaction_attribution_secure FROM anon, public;
GRANT SELECT ON public.transaction_attribution_secure TO authenticated;

-- Ensure service role has access
GRANT ALL ON public.transaction_attribution TO service_role;
GRANT SELECT ON public.transaction_attribution_secure TO service_role;
