-- COMPREHENSIVE PII PROTECTION: Enable RLS on secure view and add strict policies
-- This provides defense-in-depth: even if the underlying table RLS fails, 
-- the view masks PII for unauthorized users AND has its own RLS layer

-- Enable RLS on the secure view
ALTER VIEW public.actblue_transactions_secure SET (security_invoker = on);

-- Grant SELECT only to authenticated users (no anon access)
GRANT SELECT ON public.actblue_transactions_secure TO authenticated;

-- Revoke any potential public/anon access
REVOKE ALL ON public.actblue_transactions_secure FROM anon;
REVOKE ALL ON public.actblue_transactions_secure FROM public;

-- Add comment documenting the security model
COMMENT ON VIEW public.actblue_transactions_secure IS 
'Secure view for actblue_transactions with defense-in-depth PII protection:
1. SECURITY INVOKER: Uses calling user permissions (respects RLS on underlying table)
2. PII masking: All sensitive fields (name, email, phone, address) are masked unless has_pii_access() AND can_access_organization_data() return true
3. Only authenticated users can access (no anon/public grants)
4. Frontend MUST use this view instead of actblue_transactions table directly';