-- Revert the security_invoker change on actblue_transactions_secure
-- The view's helper functions (has_pii_access, can_access_organization_data) are SECURITY DEFINER
-- and properly handle access control. The double RLS enforcement is causing data visibility issues.

ALTER VIEW public.actblue_transactions_secure SET (security_invoker = false);

-- Add a comment explaining why this view uses security_definer
COMMENT ON VIEW public.actblue_transactions_secure IS 'Secure view for ActBlue transactions with PII masking. Uses security_definer because the helper functions (has_pii_access, can_access_organization_data) already handle authorization checks as SECURITY DEFINER functions. Setting security_invoker=true would cause double RLS enforcement on the underlying table, breaking data visibility.';