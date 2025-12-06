-- ============================================
-- COMPREHENSIVE SECURITY FIX: Remove all anon access from ALL tables
-- This is a defense-in-depth approach - RLS + no anon grants
-- ============================================

-- STEP 1: Revoke ALL permissions from anon on ALL public tables
-- This is the nuclear option - anon should NEVER have direct table access

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'REVOKE ALL ON public.' || quote_ident(r.tablename) || ' FROM anon';
        EXECUTE 'REVOKE ALL ON public.' || quote_ident(r.tablename) || ' FROM public';
    END LOOP;
END $$;

-- STEP 2: Grant access only to authenticated and service_role
-- Authenticated users will be further restricted by RLS policies

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.' || quote_ident(r.tablename) || ' TO authenticated';
        EXECUTE 'GRANT ALL ON public.' || quote_ident(r.tablename) || ' TO service_role';
    END LOOP;
END $$;

-- STEP 3: Force RLS on ALL sensitive organization-specific tables
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invite_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_entity_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_onboarding_status FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_attribution FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meta_creative_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_campaign_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sms_creative_insights FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_aggregated_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_report_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_report_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.entity_watchlist FORCE ROW LEVEL SECURITY;
ALTER TABLE public.magic_moment_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_opportunities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.generated_campaign_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.send_time_optimizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.data_freshness_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creative_performance_learnings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_impact_correlations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roi_analytics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- STEP 4: Special case - contact_submissions needs INSERT for anon (contact form)
-- But only INSERT, not SELECT/UPDATE/DELETE
GRANT INSERT ON public.contact_submissions TO anon;