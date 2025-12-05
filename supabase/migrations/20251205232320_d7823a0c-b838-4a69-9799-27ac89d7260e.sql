-- Drop existing policies and recreate with more secure configuration
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Users can view own organization transactions" ON public.actblue_transactions;

-- Create explicit policies for each operation type

-- SELECT: Users can only view transactions from their organization
CREATE POLICY "Organization members can view their transactions"
ON public.actblue_transactions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  OR public.has_role(auth.uid(), 'admin')
);

-- INSERT: Only admins can insert (webhooks use service role)
CREATE POLICY "Only admins can insert transactions"
ON public.actblue_transactions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE: Only admins can update
CREATE POLICY "Only admins can update transactions"
ON public.actblue_transactions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE: Only admins can delete
CREATE POLICY "Only admins can delete transactions"
ON public.actblue_transactions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));