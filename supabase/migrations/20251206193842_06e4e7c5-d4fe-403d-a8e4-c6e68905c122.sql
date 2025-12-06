
-- =====================================================
-- BULLETPROOF RLS POLICIES FOR SENSITIVE DATA TABLES
-- =====================================================
-- This migration implements fail-closed security by:
-- 1. Creating a strict organization membership check function
-- 2. Replacing all existing policies with bulletproof versions
-- 3. Using explicit NULL checks and membership verification
-- =====================================================

-- Step 1: Create a bulletproof organization membership verification function
-- This function returns TRUE only if the user is authenticated AND belongs to the specified org
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Fail closed: If no user is authenticated, deny access
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Fail closed: If organization_id parameter is NULL, deny access  
  IF _organization_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get the user's organization from client_users
  SELECT organization_id INTO user_org_id
  FROM public.client_users
  WHERE id = auth.uid();
  
  -- Fail closed: If user has no organization, deny access
  IF user_org_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Only return TRUE if organizations match exactly
  RETURN user_org_id = _organization_id;
END;
$$;

-- =====================================================
-- ACTBLUE_TRANSACTIONS - Donor PII Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can only view own organization transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can insert transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can update transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can delete transactions" ON public.actblue_transactions;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "actblue_select_strict" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT: Admins only (webhooks use service role)
CREATE POLICY "actblue_insert_admin_only" ON public.actblue_transactions
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: Admins only
CREATE POLICY "actblue_update_admin_only" ON public.actblue_transactions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- DELETE: Admins only
CREATE POLICY "actblue_delete_admin_only" ON public.actblue_transactions
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DONOR_DEMOGRAPHICS - Complete Donor Profiles Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can only view own organization demographics" ON public.donor_demographics;
DROP POLICY IF EXISTS "Only admins can manage demographics" ON public.donor_demographics;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "demographics_select_strict" ON public.donor_demographics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "demographics_admin_write" ON public.donor_demographics
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- META_CREATIVE_INSIGHTS - Campaign Strategy Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org Meta insights" ON public.meta_creative_insights;
DROP POLICY IF EXISTS "Admins can view all Meta insights" ON public.meta_creative_insights;
DROP POLICY IF EXISTS "Admins can manage Meta insights" ON public.meta_creative_insights;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "meta_insights_select_strict" ON public.meta_creative_insights
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "meta_insights_admin_write" ON public.meta_creative_insights
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- ATTRIBUTION_TOUCHPOINTS - Donor Journey Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org touchpoints" ON public.attribution_touchpoints;
DROP POLICY IF EXISTS "Admins can manage touchpoints" ON public.attribution_touchpoints;
DROP POLICY IF EXISTS "Admins can view all touchpoints" ON public.attribution_touchpoints;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "touchpoints_select_strict" ON public.attribution_touchpoints
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "touchpoints_admin_write" ON public.attribution_touchpoints
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- SMS_CAMPAIGN_METRICS - SMS Campaign Data Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org SMS metrics" ON public.sms_campaign_metrics;
DROP POLICY IF EXISTS "Admins can manage SMS metrics" ON public.sms_campaign_metrics;
DROP POLICY IF EXISTS "Admins can view all SMS metrics" ON public.sms_campaign_metrics;

-- SELECT: Admins OR verified organization members only  
CREATE POLICY "sms_metrics_select_strict" ON public.sms_campaign_metrics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "sms_metrics_admin_write" ON public.sms_campaign_metrics
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- META_AD_METRICS - Advertising Performance Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org Meta metrics" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "Admins can manage Meta metrics" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "Admins can view all Meta metrics" ON public.meta_ad_metrics;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "meta_metrics_select_strict" ON public.meta_ad_metrics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "meta_metrics_admin_write" ON public.meta_ad_metrics
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- META_CAMPAIGNS - Campaign Configuration Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org Meta campaigns" ON public.meta_campaigns;
DROP POLICY IF EXISTS "Admins can manage Meta campaigns" ON public.meta_campaigns;
DROP POLICY IF EXISTS "Admins can view all Meta campaigns" ON public.meta_campaigns;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "meta_campaigns_select_strict" ON public.meta_campaigns
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "meta_campaigns_admin_write" ON public.meta_campaigns
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CLIENT_API_CREDENTIALS - API Keys Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "Admins can view all credentials" ON public.client_api_credentials;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "api_credentials_select_strict" ON public.client_api_credentials
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "api_credentials_admin_write" ON public.client_api_credentials
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DAILY_AGGREGATED_METRICS - Organization Metrics Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org daily metrics" ON public.daily_aggregated_metrics;
DROP POLICY IF EXISTS "Admins can manage daily metrics" ON public.daily_aggregated_metrics;
DROP POLICY IF EXISTS "Admins can view all daily metrics" ON public.daily_aggregated_metrics;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "daily_metrics_select_strict" ON public.daily_aggregated_metrics
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "daily_metrics_admin_write" ON public.daily_aggregated_metrics
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CAMPAIGN_ATTRIBUTION - Attribution Data Protection
-- =====================================================
DROP POLICY IF EXISTS "Users can view own org attribution" ON public.campaign_attribution;
DROP POLICY IF EXISTS "Admins can manage attribution" ON public.campaign_attribution;
DROP POLICY IF EXISTS "Admins can view all attribution" ON public.campaign_attribution;

-- SELECT: Admins OR verified organization members only
CREATE POLICY "campaign_attribution_select_strict" ON public.campaign_attribution
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR user_belongs_to_organization(organization_id)
);

-- INSERT/UPDATE/DELETE: Admins only
CREATE POLICY "campaign_attribution_admin_write" ON public.campaign_attribution
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- Ensure RLS is enabled and FORCED on all sensitive tables
-- =====================================================
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_creative_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregated_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_attribution FORCE ROW LEVEL SECURITY;

-- =====================================================
-- Revoke direct table access from anon role (defense in depth)
-- =====================================================
REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.donor_demographics FROM anon;
REVOKE ALL ON public.meta_creative_insights FROM anon;
REVOKE ALL ON public.attribution_touchpoints FROM anon;
REVOKE ALL ON public.sms_campaign_metrics FROM anon;
REVOKE ALL ON public.meta_ad_metrics FROM anon;
REVOKE ALL ON public.meta_campaigns FROM anon;
REVOKE ALL ON public.client_api_credentials FROM anon;
REVOKE ALL ON public.daily_aggregated_metrics FROM anon;
REVOKE ALL ON public.campaign_attribution FROM anon;
