-- ==========================================================
-- Security Fix: Tighten RLS policies on attribution_touchpoints and contact_submissions
-- 
-- Issues:
-- 1. attribution_touchpoints has conflicting SELECT policies - one too permissive
-- 2. contact_submissions needs verification of proper anon protection
-- ==========================================================

-- ============================================================================
-- FIX 1: attribution_touchpoints - Remove overly permissive SELECT policies
-- The table has donor_email (PII) so only PII-authorized users should access it.
-- Keep only the atp_pii policy which requires has_pii_access()
-- ============================================================================

-- Drop the overly permissive policy that allows ANY org member to see donor emails
DROP POLICY IF EXISTS "Users can view own org touchpoints" ON public.attribution_touchpoints;

-- Keep atp_pii (which requires has_pii_access) as the single SELECT policy
-- Also clean up duplicate INSERT/UPDATE/DELETE policies

-- Remove duplicate INSERT policies (keep one)
DROP POLICY IF EXISTS "Admins can insert touchpoints" ON public.attribution_touchpoints;
-- Keep touchpoints_insert_org for authenticated inserts

-- Remove duplicate UPDATE policies  
DROP POLICY IF EXISTS "Admins can update touchpoints" ON public.attribution_touchpoints;
-- Keep touchpoints_update_org

-- Remove duplicate DELETE policies
DROP POLICY IF EXISTS "System admins can delete touchpoints" ON public.attribution_touchpoints;
-- Keep touchpoints_delete_admin

-- Force RLS and revoke public/anon access
ALTER TABLE public.attribution_touchpoints FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.attribution_touchpoints FROM anon;
REVOKE ALL ON public.attribution_touchpoints FROM public;

-- Add comment documenting the security model
COMMENT ON TABLE public.attribution_touchpoints IS 
'LEGACY TABLE - Contains donor_email (PII). Access restricted to users with PII access via atp_pii policy. 
campaign_attribution is the canonical source of truth for attribution data.';

-- ============================================================================
-- FIX 2: contact_submissions - Ensure proper protection
-- The table correctly has:
-- - Admin-only SELECT (cs_select)
-- - Rate-limited anon INSERT for contact form
-- Just add explicit protections
-- ============================================================================

ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;

-- Anon can only INSERT (via rate-limited policy), but cannot SELECT
REVOKE SELECT, UPDATE, DELETE ON public.contact_submissions FROM anon;
GRANT INSERT ON public.contact_submissions TO anon;

-- Revoke public access
REVOKE ALL ON public.contact_submissions FROM public;

-- Add comment documenting the security model
COMMENT ON TABLE public.contact_submissions IS 
'Contact form submissions containing PII (name, email, message). 
INSERT allowed for anon users via rate-limited policy. SELECT restricted to admins only.';