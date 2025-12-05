-- Fix RLS policies for actblue_transactions to only allow authenticated users
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins can manage transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Admins can view all actblue transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Users can view own org transactions" ON public.actblue_transactions;

-- Create properly scoped policies for authenticated users only

-- Admins can do everything (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all transactions" 
ON public.actblue_transactions 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Client users can only view transactions for their organization
CREATE POLICY "Users can view own organization transactions" 
ON public.actblue_transactions 
FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id());