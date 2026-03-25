-- ==========================================================
-- Security Fix: Add security_invoker to ab_test_performance view
-- 
-- This view aggregates business metrics from actblue_transactions.
-- By adding security_invoker=true, the view will respect the RLS 
-- policies on the underlying actblue_transactions table, ensuring
-- users can only see data for organizations they belong to.
-- ==========================================================

-- Drop and recreate the view with security_invoker=true
DROP VIEW IF EXISTS public.ab_test_performance;

CREATE VIEW public.ab_test_performance
WITH (security_invoker = true)
AS
SELECT 
    organization_id,
    ab_test_name,
    ab_test_variation,
    count(*) AS donations,
    sum(amount) AS total_raised,
    avg(amount) AS avg_donation,
    sum(CASE WHEN is_recurring THEN 1 ELSE 0 END) AS recurring_donations,
    sum(net_amount) AS net_raised,
    min(transaction_date) AS first_donation,
    max(transaction_date) AS last_donation,
    count(DISTINCT donor_email) AS unique_donors
FROM actblue_transactions
WHERE ab_test_name IS NOT NULL 
  AND transaction_type IS DISTINCT FROM 'refund'::text
GROUP BY organization_id, ab_test_name, ab_test_variation;

-- Grant access to authenticated users (RLS on underlying table controls actual access)
GRANT SELECT ON public.ab_test_performance TO authenticated;

-- Add documentation comment
COMMENT ON VIEW public.ab_test_performance IS 
'A/B test performance metrics aggregated from actblue_transactions.
Uses security_invoker=true to respect RLS policies on the underlying table.
Access is restricted to organization data based on actblue_transactions RLS policies.';