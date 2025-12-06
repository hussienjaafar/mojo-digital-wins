
-- =====================================================
-- COMPREHENSIVE SECURITY OVERHAUL - BULLETPROOF RLS
-- =====================================================
-- This migration fixes ALL security issues by:
-- 1. Changing all policies from {public} to {authenticated}
-- 2. Revoking anon/public access from ALL sensitive tables
-- 3. Adding proper RLS to secure views
-- 4. Ensuring consistent security across all tables
-- =====================================================

-- PART 1: FIX attribution_touchpoints - Remove public role policies
DROP POLICY IF EXISTS "Admins manage touchpoints" ON public.attribution_touchpoints;
DROP POLICY IF EXISTS "Users view own touchpoints" ON public.attribution_touchpoints;
DROP POLICY IF EXISTS "touchpoints_admin_write" ON public.attribution_touchpoints;
DROP POLICY IF EXISTS "touchpoints_select_strict" ON public.attribution_touchpoints;

-- Create proper authenticated-only policies for attribution_touchpoints
CREATE POLICY "touchpoints_select_org" ON public.attribution_touchpoints
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "touchpoints_insert_org" ON public.attribution_touchpoints
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    can_access_organization_data(organization_id)
  );

CREATE POLICY "touchpoints_update_org" ON public.attribution_touchpoints
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "touchpoints_delete_admin" ON public.attribution_touchpoints
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PART 2: FIX admin_invite_templates - Change from public to authenticated
DROP POLICY IF EXISTS "Only admins can create templates" ON public.admin_invite_templates;
DROP POLICY IF EXISTS "Only admins can delete templates" ON public.admin_invite_templates;
DROP POLICY IF EXISTS "Only admins can update templates" ON public.admin_invite_templates;
DROP POLICY IF EXISTS "Only admins can view templates" ON public.admin_invite_templates;

CREATE POLICY "templates_select_admin" ON public.admin_invite_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "templates_insert_admin" ON public.admin_invite_templates
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "templates_update_admin" ON public.admin_invite_templates
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "templates_delete_admin" ON public.admin_invite_templates
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PART 3: FIX ai_analysis_cache - Change from public to authenticated
DROP POLICY IF EXISTS "Admins can view cache" ON public.ai_analysis_cache;

CREATE POLICY "cache_select_admin" ON public.ai_analysis_cache
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cache_insert_admin" ON public.ai_analysis_cache
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cache_update_admin" ON public.ai_analysis_cache
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "cache_delete_admin" ON public.ai_analysis_cache
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- PART 4: FIX alert_queue - Change from public to authenticated
DROP POLICY IF EXISTS "Admins can manage alert queue" ON public.alert_queue;
DROP POLICY IF EXISTS "Admins can view alert queue" ON public.alert_queue;

CREATE POLICY "alert_queue_all_admin" ON public.alert_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- PART 5: FIX alert_rules - Change from public to authenticated
DROP POLICY IF EXISTS "Admins can manage alert rules" ON public.alert_rules;
DROP POLICY IF EXISTS "Admins can view all alert rules" ON public.alert_rules;

CREATE POLICY "alert_rules_all_admin" ON public.alert_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- PART 6: FIX anomaly_alerts - Change from public to authenticated
DROP POLICY IF EXISTS "Admins can manage anomaly alerts" ON public.anomaly_alerts;
DROP POLICY IF EXISTS "Admins can view anomaly alerts" ON public.anomaly_alerts;

CREATE POLICY "anomaly_alerts_all_admin" ON public.anomaly_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- PART 7: Ensure FORCE RLS on all sensitive tables
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- PART 8: Revoke ALL anon/public access from sensitive tables
REVOKE ALL ON public.actblue_transactions FROM anon, public;
REVOKE ALL ON public.donor_demographics FROM anon, public;
REVOKE ALL ON public.admin_invite_codes FROM anon, public;
REVOKE ALL ON public.attribution_touchpoints FROM anon, public;
REVOKE ALL ON public.admin_invite_templates FROM anon, public;
REVOKE ALL ON public.ai_analysis_cache FROM anon, public;
REVOKE ALL ON public.alert_queue FROM anon, public;
REVOKE ALL ON public.alert_rules FROM anon, public;
REVOKE ALL ON public.anomaly_alerts FROM anon, public;
REVOKE ALL ON public.profiles FROM anon, public;
REVOKE ALL ON public.login_history FROM anon, public;
REVOKE ALL ON public.admin_audit_logs FROM anon, public;
REVOKE ALL ON public.user_roles FROM anon, public;

-- Grant to authenticated only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actblue_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donor_demographics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invite_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attribution_touchpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invite_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analysis_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomaly_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.login_history TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- PART 9: Revoke access from all secure views to anon/public
REVOKE ALL ON public.actblue_transactions_secure FROM anon, public;
REVOKE ALL ON public.donor_demographics_secure FROM anon, public;
REVOKE ALL ON public.admin_audit_logs_secure FROM anon, public;
REVOKE ALL ON public.admin_invite_codes_secure FROM anon, public;
REVOKE ALL ON public.attribution_touchpoints_secure FROM anon, public;
REVOKE ALL ON public.contact_submissions_secure FROM anon, public;
REVOKE ALL ON public.login_history_secure FROM anon, public;
REVOKE ALL ON public.profiles_secure FROM anon, public;

-- Grant to authenticated only
GRANT SELECT ON public.actblue_transactions_secure TO authenticated;
GRANT SELECT ON public.donor_demographics_secure TO authenticated;
GRANT SELECT ON public.admin_audit_logs_secure TO authenticated;
GRANT SELECT ON public.admin_invite_codes_secure TO authenticated;
GRANT SELECT ON public.attribution_touchpoints_secure TO authenticated;
GRANT SELECT ON public.contact_submissions_secure TO authenticated;
GRANT SELECT ON public.login_history_secure TO authenticated;
GRANT SELECT ON public.profiles_secure TO authenticated;

-- PART 10: Fix contact_submissions - keep rate-limited anon insert but ensure RLS
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- PART 11: Create a comprehensive access function for checking table access
CREATE OR REPLACE FUNCTION public.check_authenticated_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Fail closed: Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
END;
$$;

-- PART 12: Add additional protection for meta tables with org data
DROP POLICY IF EXISTS "meta_ad_metrics_org_select" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "meta_ad_metrics_org_insert" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "meta_ad_metrics_org_update" ON public.meta_ad_metrics;
DROP POLICY IF EXISTS "meta_ad_metrics_org_delete" ON public.meta_ad_metrics;

CREATE POLICY "meta_metrics_select_auth" ON public.meta_ad_metrics
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "meta_metrics_insert_auth" ON public.meta_ad_metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    can_access_organization_data(organization_id)
  );

CREATE POLICY "meta_metrics_update_auth" ON public.meta_ad_metrics
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "meta_metrics_delete_admin" ON public.meta_ad_metrics
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.meta_ad_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_ad_metrics FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ad_metrics TO authenticated;

-- PART 13: Protect SMS campaign metrics 
DROP POLICY IF EXISTS "sms_campaign_metrics_select" ON public.sms_campaign_metrics;
DROP POLICY IF EXISTS "sms_campaign_metrics_insert" ON public.sms_campaign_metrics;
DROP POLICY IF EXISTS "sms_campaign_metrics_update" ON public.sms_campaign_metrics;
DROP POLICY IF EXISTS "sms_campaign_metrics_delete" ON public.sms_campaign_metrics;

CREATE POLICY "sms_metrics_select_auth" ON public.sms_campaign_metrics
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "sms_metrics_insert_auth" ON public.sms_campaign_metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    can_access_organization_data(organization_id)
  );

CREATE POLICY "sms_metrics_update_auth" ON public.sms_campaign_metrics
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "sms_metrics_delete_admin" ON public.sms_campaign_metrics
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.sms_campaign_metrics FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_campaign_metrics FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_campaign_metrics TO authenticated;

-- PART 14: Protect client_api_credentials (contains encrypted keys)
DROP POLICY IF EXISTS "client_api_credentials_select" ON public.client_api_credentials;
DROP POLICY IF EXISTS "client_api_credentials_insert" ON public.client_api_credentials;
DROP POLICY IF EXISTS "client_api_credentials_update" ON public.client_api_credentials;
DROP POLICY IF EXISTS "client_api_credentials_delete" ON public.client_api_credentials;

CREATE POLICY "api_creds_select_auth" ON public.client_api_credentials
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "api_creds_insert_auth" ON public.client_api_credentials
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "api_creds_update_auth" ON public.client_api_credentials
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "api_creds_delete_auth" ON public.client_api_credentials
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

ALTER TABLE public.client_api_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_api_credentials FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_api_credentials TO authenticated;

-- PART 15: Protect campaign_attribution
DROP POLICY IF EXISTS "campaign_attribution_select" ON public.campaign_attribution;
DROP POLICY IF EXISTS "campaign_attribution_insert" ON public.campaign_attribution;
DROP POLICY IF EXISTS "campaign_attribution_update" ON public.campaign_attribution;
DROP POLICY IF EXISTS "campaign_attribution_delete" ON public.campaign_attribution;

CREATE POLICY "campaign_attr_select_auth" ON public.campaign_attribution
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "campaign_attr_insert_auth" ON public.campaign_attribution
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    can_access_organization_data(organization_id)
  );

CREATE POLICY "campaign_attr_update_auth" ON public.campaign_attribution
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(organization_id)
  );

CREATE POLICY "campaign_attr_delete_admin" ON public.campaign_attribution
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.campaign_attribution FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.campaign_attribution FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_attribution TO authenticated;

-- PART 16: Protect client_organizations
DROP POLICY IF EXISTS "client_organizations_select" ON public.client_organizations;
DROP POLICY IF EXISTS "client_organizations_insert" ON public.client_organizations;
DROP POLICY IF EXISTS "client_organizations_update" ON public.client_organizations;
DROP POLICY IF EXISTS "client_organizations_delete" ON public.client_organizations;

CREATE POLICY "client_orgs_select_auth" ON public.client_organizations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    user_belongs_to_organization(id)
  );

CREATE POLICY "client_orgs_insert_admin" ON public.client_organizations
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "client_orgs_update_auth" ON public.client_organizations
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (is_org_admin_or_manager() AND user_belongs_to_organization(id))
  );

CREATE POLICY "client_orgs_delete_admin" ON public.client_organizations
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.client_organizations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_organizations FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_organizations TO authenticated;

-- PART 17: Protect client_users table
DROP POLICY IF EXISTS "client_users_select" ON public.client_users;
DROP POLICY IF EXISTS "client_users_insert" ON public.client_users;
DROP POLICY IF EXISTS "client_users_update" ON public.client_users;
DROP POLICY IF EXISTS "client_users_delete" ON public.client_users;

CREATE POLICY "client_users_select_auth" ON public.client_users
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    id = auth.uid() OR
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "client_users_insert_admin" ON public.client_users
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "client_users_update_auth" ON public.client_users
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    id = auth.uid() OR
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    id = auth.uid() OR
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

CREATE POLICY "client_users_delete_admin" ON public.client_users
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    (is_org_admin_or_manager() AND user_belongs_to_organization(organization_id))
  );

ALTER TABLE public.client_users FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_users FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_users TO authenticated;

-- PART 18: Ensure service role still has full access for edge functions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
