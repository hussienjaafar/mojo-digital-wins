
-- Drop and recreate get_actblue_daily_rollup with updated column mapping
DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(uuid, date, date);

CREATE FUNCTION public.get_actblue_daily_rollup(
  _organization_id uuid, 
  _start_date date, 
  _end_date date
)
RETURNS TABLE(
  day date, 
  gross_raised numeric, 
  net_raised numeric, 
  refunds numeric, 
  net_revenue numeric, 
  total_fees numeric, 
  donation_count bigint, 
  unique_donors bigint, 
  refund_count bigint, 
  recurring_count bigint, 
  one_time_count bigint, 
  recurring_revenue numeric, 
  one_time_revenue numeric,
  fee_percentage numeric,
  refund_rate numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    r.day,
    r.gross_donations AS gross_raised,
    r.net_donations AS net_raised,
    r.refund_amount AS refunds,
    r.net_revenue,
    r.total_fees,
    r.donation_count::BIGINT,
    r.unique_donors::BIGINT,
    r.refund_count::BIGINT,
    r.recurring_count::BIGINT,
    (r.donation_count - r.recurring_count)::BIGINT AS one_time_count,
    r.recurring_amount AS recurring_revenue,
    (r.gross_donations - r.recurring_amount) AS one_time_revenue,
    CASE WHEN r.gross_donations > 0 THEN (r.total_fees / r.gross_donations * 100) ELSE 0 END AS fee_percentage,
    CASE WHEN r.donation_count > 0 THEN (r.refund_count::NUMERIC / r.donation_count * 100) ELSE 0 END AS refund_rate
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
    )
  ORDER BY r.day;
$function$;
