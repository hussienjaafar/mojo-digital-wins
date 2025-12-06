-- COMPREHENSIVE FIX: Revoke all permissions from anon role on sensitive tables
-- This ensures defense-in-depth: even if RLS is bypassed, anon cannot access

-- 1. Revoke ALL permissions from anon on actblue_transactions
REVOKE ALL ON public.actblue_transactions FROM anon;

-- 2. Revoke from public role as well (belt and suspenders)
REVOKE ALL ON public.actblue_transactions FROM public;

-- 3. Ensure only authenticated and service_role can access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actblue_transactions TO authenticated;
GRANT ALL ON public.actblue_transactions TO service_role;

-- 4. Similarly fix donor_demographics (another flagged table)
REVOKE ALL ON public.donor_demographics FROM anon;
REVOKE ALL ON public.donor_demographics FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donor_demographics TO authenticated;
GRANT ALL ON public.donor_demographics TO service_role;

-- 5. Fix admin_audit_logs (another flagged table - should be admin only)
REVOKE ALL ON public.admin_audit_logs FROM anon;
REVOKE ALL ON public.admin_audit_logs FROM public;
-- Only authenticated users with admin role should access (enforced via RLS)
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- 6. Verify RLS is still enforced on all these tables
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donor_demographics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs FORCE ROW LEVEL SECURITY;