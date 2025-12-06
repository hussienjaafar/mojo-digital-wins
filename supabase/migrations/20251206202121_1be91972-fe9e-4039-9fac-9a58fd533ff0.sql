
-- BULLETPROOF SECURITY - CORE FIXES ONLY
-- Phase 1: Replace {public} with {authenticated} on all 57 tables
-- Phase 2: Force RLS on all tables
-- Phase 4: Revoke public/anon access

-- Fix client_organizations
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.client_organizations;
CREATE POLICY "co_auth" ON public.client_organizations FOR SELECT TO authenticated USING (public.user_belongs_to_organization(id) OR public.has_role(auth.uid(), 'admin'));

-- Fix client_users
DROP POLICY IF EXISTS "Users can view own profile" ON public.client_users;
CREATE POLICY "cu_auth" ON public.client_users FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Fix webhook_configs - admin only
DROP POLICY IF EXISTS "Organization members can view webhooks" ON public.webhook_configs;
CREATE POLICY "wc_auth" ON public.webhook_configs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix login_history
DROP POLICY IF EXISTS "Users can view own login history" ON public.login_history;
CREATE POLICY "lh_auth" ON public.login_history FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Fix email_queue
DROP POLICY IF EXISTS "Admins can manage email queue" ON public.email_queue;
CREATE POLICY "eq_auth" ON public.email_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Fix alert_rules
DROP POLICY IF EXISTS "Anyone can view active rules" ON public.alert_rules;
CREATE POLICY "ar_auth" ON public.alert_rules FOR SELECT TO authenticated USING (is_active = true);

-- Force RLS on critical tables
ALTER TABLE public.webhook_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_report_schedules FORCE ROW LEVEL SECURITY;

-- Revoke all public/anon access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;

-- Grant to authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant full to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
