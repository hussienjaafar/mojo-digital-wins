
-- Drop both functions first to ensure clean state
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(uuid, date, date);

-- Recreate with correct column names
CREATE FUNCTION public.get_actblue_period_summary(
  _organization_id uuid, 
  _start_date date, 
  _end_date date
)
RETURNS TABLE(
  gross_raised numeric, 
  net_raised numeric, 
  refunds numeric, 
  net_revenue numeric, 
  total_fees numeric, 
  donation_count bigint, 
  unique_donors_approx bigint, 
  refund_count bigint, 
  recurring_count bigint, 
  one_time_count bigint, 
  recurring_revenue numeric, 
  one_time_revenue numeric, 
  avg_fee_percentage numeric, 
  refund_rate numeric, 
  avg_donation numeric, 
  days_with_donations bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(SUM(r.gross_donations), 0) AS gross_raised,
    COALESCE(SUM(r.net_donations), 0) AS net_raised,
    COALESCE(SUM(r.refund_amount), 0) AS refunds,
    COALESCE(SUM(r.net_revenue), 0) AS net_revenue,
    COALESCE(SUM(r.total_fees), 0) AS total_fees,
    COALESCE(SUM(r.donation_count), 0)::BIGINT AS donation_count,
    COALESCE(SUM(r.unique_donors), 0)::BIGINT AS unique_donors_approx,
    COALESCE(SUM(r.refund_count), 0)::BIGINT AS refund_count,
    COALESCE(SUM(r.recurring_count), 0)::BIGINT AS recurring_count,
    (COALESCE(SUM(r.donation_count), 0) - COALESCE(SUM(r.recurring_count), 0))::BIGINT AS one_time_count,
    COALESCE(SUM(r.recurring_amount), 0) AS recurring_revenue,
    (COALESCE(SUM(r.gross_donations), 0) - COALESCE(SUM(r.recurring_amount), 0)) AS one_time_revenue,
    CASE 
      WHEN SUM(r.gross_donations) > 0 
      THEN (SUM(r.total_fees) / SUM(r.gross_donations) * 100)
      ELSE 0 
    END AS avg_fee_percentage,
    CASE 
      WHEN SUM(r.donation_count) > 0 
      THEN (SUM(r.refund_count)::NUMERIC / SUM(r.donation_count) * 100)
      ELSE 0 
    END AS refund_rate,
    CASE 
      WHEN SUM(r.donation_count) > 0 
      THEN (SUM(r.net_revenue) / SUM(r.donation_count))
      ELSE 0 
    END AS avg_donation,
    COUNT(*) AS days_with_donations
  FROM actblue_daily_rollup r
  WHERE r.organization_id = _organization_id
    AND r.day >= _start_date
    AND r.day <= _end_date
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR 
      EXISTS (
        SELECT 1 FROM client_users cu
        WHERE cu.id = auth.uid()
          AND cu.organization_id = _organization_id
      )
    );
$function$;
