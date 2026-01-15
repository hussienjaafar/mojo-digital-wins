
-- Drop and recreate actblue_daily_rollup view with security_invoker
DROP VIEW IF EXISTS public.actblue_daily_rollup;

CREATE VIEW public.actblue_daily_rollup
WITH (security_invoker = on)
AS
SELECT 
  organization_id,
  (transaction_date AT TIME ZONE 'UTC')::date as day,
  COUNT(*) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund') as donation_count,
  COALESCE(SUM(amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as gross_donations,
  COALESCE(SUM(fee) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as total_fees,
  COALESCE(SUM(net_amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) as net_donations,
  COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as refund_amount,
  COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_count,
  COALESCE(SUM(net_amount) FILTER (WHERE transaction_type IS DISTINCT FROM 'refund'), 0) 
    - COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as net_revenue,
  COUNT(DISTINCT 
    CASE WHEN transaction_type IS DISTINCT FROM 'refund' 
    THEN COALESCE(donor_email, first_name || ' ' || last_name) 
    END
  ) as unique_donors,
  COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type IS DISTINCT FROM 'refund') as recurring_count,
  COALESCE(SUM(amount) FILTER (WHERE is_recurring = true AND transaction_type IS DISTINCT FROM 'refund'), 0) as recurring_amount
FROM public.actblue_transactions_secure
GROUP BY organization_id, (transaction_date AT TIME ZONE 'UTC')::date;

-- Grant access to authenticated users
GRANT SELECT ON public.actblue_daily_rollup TO authenticated;

COMMENT ON VIEW public.actblue_daily_rollup IS 'Daily aggregated ActBlue metrics sourced from secure view. Uses security_invoker for proper auth context.';
