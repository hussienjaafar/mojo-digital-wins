
-- Fix security definer view by using security invoker instead
DROP VIEW IF EXISTS public.unmatched_refcodes;

CREATE VIEW public.unmatched_refcodes 
WITH (security_invoker = true) AS
SELECT 
  at.refcode,
  at.organization_id,
  COUNT(*) as transaction_count,
  SUM(at.amount) as total_revenue,
  MIN(at.transaction_date) as first_seen,
  MAX(at.transaction_date) as last_seen
FROM actblue_transactions at
WHERE at.refcode IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campaign_attribution ca 
    WHERE ca.refcode = at.refcode 
    AND ca.organization_id = at.organization_id
  )
GROUP BY at.refcode, at.organization_id
ORDER BY total_revenue DESC;

COMMENT ON VIEW public.unmatched_refcodes IS 'Shows ActBlue refcodes that have revenue but no campaign attribution mapping';
