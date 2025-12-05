-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins view all attribution" ON public.transaction_attribution;
DROP POLICY IF EXISTS "Service calculate attribution" ON public.transaction_attribution;
DROP POLICY IF EXISTS "Users view own attribution" ON public.transaction_attribution;

-- Ensure RLS is enabled
ALTER TABLE public.transaction_attribution ENABLE ROW LEVEL SECURITY;

-- Create proper policies restricted to authenticated users

-- SELECT: Users can only view attribution data from their organization
CREATE POLICY "Organization members can view their attribution"
ON public.transaction_attribution
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  OR public.has_role(auth.uid(), 'admin')
);

-- INSERT: Only admins can insert (edge functions use service role)
CREATE POLICY "Only admins can insert attribution"
ON public.transaction_attribution
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE: Only admins can update
CREATE POLICY "Only admins can update attribution"
ON public.transaction_attribution
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE: Only admins can delete
CREATE POLICY "Only admins can delete attribution"
ON public.transaction_attribution
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));