-- ============================================
-- BULLETPROOF RLS POLICIES FOR SENSITIVE TABLES
-- Ensures NO cross-organization data leakage
-- ============================================

-- 1. Create a safer version of get_user_organization_id that handles edge cases
CREATE OR REPLACE FUNCTION public.get_user_organization_id_safe()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Return NULL if not authenticated
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get organization_id from client_users
  SELECT organization_id INTO org_id
  FROM public.client_users
  WHERE id = auth.uid();
  
  -- Return the org_id (could be NULL if user not in client_users)
  RETURN org_id;
END;
$$;

-- 2. Drop and recreate actblue_transactions policies with bulletproof logic
DROP POLICY IF EXISTS "Organization members can view their transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can insert transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can update transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Only admins can delete transactions" ON public.actblue_transactions;

-- SELECT: Users can ONLY see their organization's data (strict check)
CREATE POLICY "Users can only view own organization transactions"
ON public.actblue_transactions
FOR SELECT
TO authenticated
USING (
  -- Admin check first
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- Strict organization check with explicit NULL protection
  (
    get_user_organization_id_safe() IS NOT NULL
    AND organization_id = get_user_organization_id_safe()
  )
);

-- INSERT: Only admins or service role
CREATE POLICY "Only admins can insert transactions"
ON public.actblue_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- UPDATE: Only admins
CREATE POLICY "Only admins can update transactions"
ON public.actblue_transactions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- DELETE: Only admins
CREATE POLICY "Only admins can delete transactions"
ON public.actblue_transactions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix donor_demographics with same bulletproof approach
DROP POLICY IF EXISTS "Users view own demographics" ON public.donor_demographics;
DROP POLICY IF EXISTS "Admins manage demographics" ON public.donor_demographics;

CREATE POLICY "Users can only view own organization demographics"
ON public.donor_demographics
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR
  (
    get_user_organization_id_safe() IS NOT NULL
    AND organization_id = get_user_organization_id_safe()
  )
);

CREATE POLICY "Only admins can manage demographics"
ON public.donor_demographics
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix admin_invite_codes - only super admins should see these
DROP POLICY IF EXISTS "Only admins can view invite codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Only admins can create invite codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Only admins can update invite codes" ON public.admin_invite_codes;
DROP POLICY IF EXISTS "Only admins can delete invite codes" ON public.admin_invite_codes;

CREATE POLICY "Only admins can manage invite codes"
ON public.admin_invite_codes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Add rate limiting check function for contact submissions
CREATE OR REPLACE FUNCTION public.check_contact_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Count submissions from the same IP-ish in last hour
  -- (We can't get IP in RLS, so we just limit total submissions)
  SELECT COUNT(*) INTO recent_count
  FROM public.contact_submissions
  WHERE created_at > NOW() - INTERVAL '1 hour';
  
  -- Allow max 100 submissions per hour globally
  RETURN recent_count < 100;
END;
$$;

-- 6. Update contact_submissions policy to include basic rate limiting
DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;

CREATE POLICY "Rate limited contact form submissions"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (check_contact_rate_limit());

CREATE POLICY "Only admins can view contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage contact submissions"
ON public.contact_submissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));