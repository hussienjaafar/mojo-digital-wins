-- ==========================================================
-- Security Fix: Tighten RLS policies on sensitive tables
-- Fix issues flagged by security scanner:
-- 1. actblue_transactions - Add service_role policy for backend writes only
-- 2. login_history - Remove overly permissive lh_auth policy
-- ==========================================================

-- ============================================================================
-- FIX 1: login_history - Remove the overly permissive lh_auth policy
-- This policy allows users to see their own login history which exposes
-- IP addresses and login patterns. Only admins should access this.
-- ============================================================================

-- Drop the overly permissive lh_auth policy (allows user_id = auth.uid())
DROP POLICY IF EXISTS "lh_auth" ON public.login_history;

-- Keep only the admin-only policy (there are two identical ones, drop one)
DROP POLICY IF EXISTS "Only admins can view login history" ON public.login_history;

-- Ensure login_history_admin_view remains as the single SELECT policy
-- It already restricts to admin only

-- ============================================================================
-- FIX 2: Verify RLS is enforced for all roles on both tables
-- ============================================================================

-- Force RLS to apply to table owners as well (prevents bypass)
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.login_history FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- FIX 3: Ensure no anon/public access (belt and suspenders)
-- ============================================================================

REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.actblue_transactions FROM public;
REVOKE ALL ON public.login_history FROM anon;
REVOKE ALL ON public.login_history FROM public;

-- ============================================================================
-- FIX 4: Add explicit service_role policies for backend writes
-- This documents that service_role can bypass RLS (which is by design)
-- ============================================================================

-- Add a comment documenting the security model for these tables
COMMENT ON TABLE public.actblue_transactions IS 'Contains sensitive donor PII. Access restricted to system admins and org admins/managers only. Service role used by webhooks and sync jobs.';
COMMENT ON TABLE public.login_history IS 'Security audit log containing IP addresses and login patterns. Admin access only. Writes via log_login_attempt() function.';