-- ==========================================================
-- Fix: Remove overly permissive SELECT policy on actblue_transactions
-- The "Users can view own org transactions" policy allows ANY org member to view 
-- donor PII. This should be restricted to admin/manager roles only.
-- The existing "actblue_pii_select" policy already correctly enforces this.
-- ==========================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view own org transactions" ON public.actblue_transactions;

-- Also drop other redundant policies that are less restrictive than the actblue_pii_* policies
DROP POLICY IF EXISTS "Admins can insert transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON public.actblue_transactions;
DROP POLICY IF EXISTS "System admins can delete transactions" ON public.actblue_transactions;

-- Verify remaining policies are the properly restrictive ones:
-- actblue_pii_select, actblue_pii_insert, actblue_pii_update, actblue_pii_delete

-- Add a comment documenting the security model
COMMENT ON TABLE public.actblue_transactions IS 
'Contains donor PII (names, emails, addresses, phone numbers). 
Access is restricted to:
- System admins (user_roles.role = admin)  
- Organization admins/managers (client_users.role IN (admin, manager))

All SELECT/INSERT/UPDATE/DELETE operations require one of these privileged roles.
Regular org viewers/members cannot access this table directly.
Frontend should use actblue_transactions_secure view for PII masking.';