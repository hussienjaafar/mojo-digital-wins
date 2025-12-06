-- Fix actblue_transactions RLS to properly protect donor data
-- Drop the existing restrictive SELECT policy and create a permissive one

DROP POLICY IF EXISTS "Organization members can view their transactions" ON public.actblue_transactions;

-- Create a permissive SELECT policy that properly restricts access
CREATE POLICY "Organization members can view their transactions"
ON public.actblue_transactions
FOR SELECT
TO authenticated
USING (
  (organization_id = get_user_organization_id()) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- The existing INSERT, UPDATE, DELETE policies are already admin-only which is correct
-- Just verify RLS is enabled (it should already be)
ALTER TABLE public.actblue_transactions ENABLE ROW LEVEL SECURITY;

-- Force RLS to apply to table owners as well (extra security)
ALTER TABLE public.actblue_transactions FORCE ROW LEVEL SECURITY;