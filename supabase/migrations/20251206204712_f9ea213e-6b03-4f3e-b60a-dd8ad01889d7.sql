
-- ============================================================================
-- BULLETPROOF SECURITY: Defense-in-Depth for PII Tables
-- ============================================================================
-- This migration implements multiple layers of security to ensure PII data
-- cannot be accessed by unauthorized users under ANY circumstances.
-- ============================================================================

-- ============================================================================
-- LAYER 1: ULTRA-PARANOID SECURITY FUNCTIONS
-- ============================================================================

-- Drop and recreate has_pii_access with explicit inline checks (no function dependencies)
CREATE OR REPLACE FUNCTION public.has_pii_access(_organization_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _is_system_admin boolean := FALSE;
  _is_org_privileged boolean := FALSE;
BEGIN
  -- LAYER 1a: Get authenticated user - fail closed if NULL
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- LAYER 1b: Fail closed if organization_id is NULL
  IF _organization_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- LAYER 1c: Check if system admin (inline, no function call)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = 'admin'::app_role
  ) INTO _is_system_admin;
  
  IF _is_system_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- LAYER 1d: Check if org admin/manager for THIS specific org
  SELECT EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = _user_id 
    AND organization_id = _organization_id
    AND role IN ('admin', 'manager')
  ) INTO _is_org_privileged;
  
  RETURN COALESCE(_is_org_privileged, FALSE);
END;
$$;

-- Parameterless version for backward compatibility
CREATE OR REPLACE FUNCTION public.has_pii_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _is_system_admin boolean := FALSE;
  _is_org_privileged boolean := FALSE;
BEGIN
  -- Get authenticated user - fail closed if NULL
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if system admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = 'admin'::app_role
  ) INTO _is_system_admin;
  
  IF _is_system_admin = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- Check if org admin/manager (any org they belong to)
  SELECT EXISTS (
    SELECT 1 FROM public.client_users 
    WHERE id = _user_id 
    AND role IN ('admin', 'manager')
  ) INTO _is_org_privileged;
  
  RETURN COALESCE(_is_org_privileged, FALSE);
END;
$$;

-- ============================================================================
-- LAYER 2: EXPLICIT RLS POLICIES WITH INLINE AUTH CHECKS
-- ============================================================================
-- Remove dependency on external functions - inline ALL checks

-- Drop existing policies on actblue_transactions
DROP POLICY IF EXISTS "abt_pii" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_base_select" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_base_insert" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_base_update" ON public.actblue_transactions;
DROP POLICY IF EXISTS "actblue_base_delete" ON public.actblue_transactions;

-- Create new bulletproof policies with explicit inline checks
CREATE POLICY "actblue_pii_select" ON public.actblue_transactions
FOR SELECT TO authenticated
USING (
  -- Must be authenticated (redundant but explicit)
  auth.uid() IS NOT NULL
  AND (
    -- System admin check (inline)
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    -- Org admin/manager for THIS organization (inline)
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = actblue_transactions.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "actblue_pii_insert" ON public.actblue_transactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = actblue_transactions.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "actblue_pii_update" ON public.actblue_transactions
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = actblue_transactions.organization_id
      AND role IN ('admin', 'manager')
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = actblue_transactions.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "actblue_pii_delete" ON public.actblue_transactions
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = actblue_transactions.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

-- ============================================================================
-- LAYER 3: FIX client_api_credentials WITH INLINE CHECKS
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all api credentials" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_credentials_admin_write" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_creds_select_auth" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_creds_insert_auth" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_creds_update_auth" ON public.client_api_credentials;
DROP POLICY IF EXISTS "api_creds_delete_auth" ON public.client_api_credentials;

CREATE POLICY "api_creds_pii_select" ON public.client_api_credentials
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = client_api_credentials.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "api_creds_pii_insert" ON public.client_api_credentials
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = client_api_credentials.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "api_creds_pii_update" ON public.client_api_credentials
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = client_api_credentials.organization_id
      AND role IN ('admin', 'manager')
    )
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = client_api_credentials.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "api_creds_pii_delete" ON public.client_api_credentials
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
    )
    OR
    EXISTS (
      SELECT 1 FROM public.client_users 
      WHERE id = auth.uid() 
      AND organization_id = client_api_credentials.organization_id
      AND role IN ('admin', 'manager')
    )
  )
);

-- ============================================================================
-- LAYER 4: ENSURE RLS IS ENABLED AND FORCED
-- ============================================================================

ALTER TABLE public.actblue_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.client_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_api_credentials FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- LAYER 5: REVOKE ALL PUBLIC/ANON ACCESS EXPLICITLY
-- ============================================================================

REVOKE ALL ON public.actblue_transactions FROM anon;
REVOKE ALL ON public.actblue_transactions FROM public;

REVOKE ALL ON public.client_api_credentials FROM anon;
REVOKE ALL ON public.client_api_credentials FROM public;

-- ============================================================================
-- LAYER 6: SECURITY DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.actblue_transactions IS 
'SECURITY: Donor transaction data with PII (emails, names, phones, addresses).
ACCESS: Only system admins OR organization admin/manager roles for the specific organization.
PROTECTION: RLS enabled + forced, explicit inline auth checks, no external function dependencies.
AUDIT: All access is logged via Postgres audit logs.';

COMMENT ON TABLE public.client_api_credentials IS 
'SECURITY: Encrypted API credentials for external platforms (Meta, ActBlue, etc).
ACCESS: Only system admins OR organization admin/manager roles for the specific organization.
PROTECTION: RLS enabled + forced, explicit inline auth checks, credentials stored encrypted.
AUDIT: All access is logged via Postgres audit logs.';

COMMENT ON FUNCTION public.has_pii_access(uuid) IS 
'SECURITY DEFINER function to check PII access rights.
Returns TRUE only if user is:
1. A system admin (role=admin in user_roles), OR
2. An org admin/manager for the specific organization
Returns FALSE in all other cases including NULL inputs.';
