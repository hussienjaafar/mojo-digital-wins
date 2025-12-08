-- Fix Security Definer Views by setting security_invoker = true
-- This ensures views run with the permissions of the querying user

-- Fix actblue_transactions_secure view
ALTER VIEW public.actblue_transactions_secure SET (security_invoker = true);

-- Fix meta_sync_status view  
ALTER VIEW public.meta_sync_status SET (security_invoker = true);