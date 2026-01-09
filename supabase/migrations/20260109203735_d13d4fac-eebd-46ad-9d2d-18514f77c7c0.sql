
-- Fix the watchlist_usage_log policy - restrict to org members or service role
DROP POLICY IF EXISTS "Service log usage" ON public.watchlist_usage_log;

-- Allow authenticated users who belong to the organization to log usage
CREATE POLICY "Org members can log their usage"
ON public.watchlist_usage_log
FOR INSERT
TO authenticated
WITH CHECK (public.user_belongs_to_organization(organization_id));

-- Service role for backend operations
CREATE POLICY "Service role can manage usage logs"
ON public.watchlist_usage_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
