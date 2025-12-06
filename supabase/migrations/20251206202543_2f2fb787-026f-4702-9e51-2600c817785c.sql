
-- BULLETPROOF SECURITY - BATCH 3: Create has_pii_access + fix critical tables

-- Create has_pii_access function (checks if user has PII access for org)
CREATE OR REPLACE FUNCTION public.has_pii_access(_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fail closed: deny if not authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Admins have PII access
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user belongs to org and has admin/manager role
  RETURN EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = auth.uid() 
    AND organization_id = _organization_id
    AND role IN ('admin', 'manager')
  );
END;
$$;

-- 1. actblue_transactions - strict org + PII check
DROP POLICY IF EXISTS "Organization members view transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Organization members view via PII" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_select_pii" ON public.actblue_transactions;
CREATE POLICY "abt_pii" ON public.actblue_transactions FOR SELECT TO authenticated 
USING (public.has_pii_access(organization_id));
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;

-- 2. donor_demographics - strict org + PII check
DROP POLICY IF EXISTS "Organization members view demographics" ON public.donor_demographics;
DROP POLICY IF EXISTS "Organization members view via PII" ON public.donor_demographics;
DROP POLICY IF EXISTS "demographics_select_pii" ON public.donor_demographics;
CREATE POLICY "dd_pii" ON public.donor_demographics FOR SELECT TO authenticated 
USING (public.has_pii_access(organization_id));
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;

-- 3. profiles - own profile or admin
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "prof_own" ON public.profiles;
DROP POLICY IF EXISTS "prof_admin" ON public.profiles;
CREATE POLICY "profiles_auth" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- 4. admin_invite_codes - creator only with expiry check
DROP POLICY IF EXISTS "Creators can view their codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Admins can create codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "aic_creator" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "aic_admin_insert" ON public.admin_invite_codes;
CREATE POLICY "aic_select" ON public.admin_invite_codes FOR SELECT TO authenticated 
USING (created_by = auth.uid() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "aic_insert" ON public.admin_invite_codes FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "aic_update" ON public.admin_invite_codes FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;

-- 5. client_api_credentials - org admin/manager only
DROP POLICY IF EXISTS "Organization admins manage credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "Organization members view credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "cac_admin" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_credentials_pii" ON public.client_api_credentials;
CREATE POLICY "cac_pii" ON public.client_api_credentials FOR ALL TO authenticated 
USING (public.has_pii_access(organization_id))
WITH CHECK (public.has_pii_access(organization_id));
ALTER TABLE public.client_api_credentials FORCE ROW LEVEL SECURITY;

-- 6. contact_submissions - admin only for reads
DROP POLICY IF EXISTS "Admins can view submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "cs_admin" ON public.contact_submissions;
CREATE POLICY "cs_select" ON public.contact_submissions FOR SELECT TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- 7. transaction_attribution - PII access required
DROP POLICY IF EXISTS "tx_attr_select_pii" ON public.transaction_attribution;
CREATE POLICY "ta_pii" ON public.transaction_attribution FOR SELECT TO authenticated 
USING (public.has_pii_access(organization_id));
ALTER TABLE public.transaction_attribution FORCE ROW LEVEL SECURITY;

-- 8. attribution_touchpoints - PII access required
DROP POLICY IF EXISTS "touchpoints_select_org" ON public.attribution_touchpoints;
CREATE POLICY "atp_pii" ON public.attribution_touchpoints FOR SELECT TO authenticated 
USING (public.has_pii_access(organization_id));
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
