
-- ULTRA-SECURE: Tighten client_api_credentials SELECT policies
-- Remove the overly permissive policy that allows any org member to see credentials

-- Drop the permissive policy that allows any org member to SELECT
DROP POLICY IF EXISTS "api_credentials_select_strict" ON public.client_api_credentials;

-- Drop any potentially redundant/overlapping policies
DROP POLICY IF EXISTS "cac_pii" ON public.client_api_credentials;

-- Keep only the strictest policies:
-- 1. api_creds_select_auth (admin OR org admin/manager)
-- 2. api_credentials_admin_write (admin only for ALL)
-- 3. api_creds_insert_auth / api_creds_update_auth / api_creds_delete_auth

-- Verify the table still has proper protection
COMMENT ON TABLE public.client_api_credentials IS 'API credentials for external platforms. Protected by strict RLS requiring admin OR organization admin/manager role.';

-- Also ensure actblue_transactions doesn't have redundant SELECT policies
-- The abt_pii policy uses has_pii_access(organization_id) which is more specific
-- The actblue_base_select uses has_pii_access() AND can_access_organization_data()
-- These are both fine as they both require PII access, just different function signatures

-- Add explicit comment documenting the security model
COMMENT ON TABLE public.actblue_transactions IS 'Donor transaction data with PII. Protected by RLS requiring has_pii_access() function validation - only admins and org admin/managers can access.';
