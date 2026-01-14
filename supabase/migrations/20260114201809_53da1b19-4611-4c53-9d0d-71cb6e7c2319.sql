-- Fix type mismatch and correct column references
-- View uses 'day' not 'donation_day', and correct column names

CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE (
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  total_fees NUMERIC,
  donation_count BIGINT,
  unique_donors_approx BIGINT,
  refund_count BIGINT,
  recurring_count BIGINT,
  one_time_count BIGINT,
  recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  avg_fee_percentage NUMERIC,
  refund_rate NUMERIC,
  avg_donation NUMERIC,
  days_with_donations BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(r.gross_raised), 0) AS gross_raised,
    COALESCE(SUM(r.net_raised), 0) AS net_raised,
    COALESCE(SUM(r.refunds), 0) AS refunds,
    COALESCE(SUM(r.net_revenue), 0) AS net_revenue,
    COALESCE(SUM(r.total_fees), 0) AS total_fees,
    COALESCE(SUM(r.donation_count), 0)::BIGINT AS donation_count,
    COALESCE(SUM(r.unique_donors), 0)::BIGINT AS unique_donors_approx,
    COALESCE(SUM(r.refund_count), 0)::BIGINT AS refund_count,
    COALESCE(SUM(r.recurring_count), 0)::BIGINT AS recurring_count,
    COALESCE(SUM(r.one_time_count), 0)::BIGINT AS one_time_count,
    COALESCE(SUM(r.recurring_revenue), 0) AS recurring_revenue,
    COALESCE(SUM(r.one_time_revenue), 0) AS one_time_revenue,
    CASE 
      WHEN SUM(r.gross_raised) > 0 
      THEN (SUM(r.total_fees) / SUM(r.gross_raised) * 100)
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
    AND EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.id = auth.uid()
        AND cu.organization_id = _organization_id
    );
$$;

-- Also fix get_actblue_daily_rollup to use correct column name
CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
  _organization_id UUID,
  _start_date DATE,
  _end_date DATE
)
RETURNS TABLE (
  day DATE,
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  total_fees NUMERIC,
  donation_count BIGINT,
  unique_donors BIGINT,
  refund_count BIGINT,
  recurring_count BIGINT,
  one_time_count BIGINT,
  recurring_revenue NUMERIC,
  one_time_revenue NUMERIC,
  fee_percentage NUMERIC,
  refund_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.day,
    r.gross_raised,
    r.net_raised,
    r.refunds,
    r.net_revenue,
    r.total_fees,
    r.donation_count,
    r.unique_donors,
    r.refund_count,
    r.recurring_count,
    r.one_time_count,
    r.recurring_revenue,
    r.one_time_revenue,
    r.fee_percentage,
    r.refund_rate
  FROM actblue_daily_rollup r
  WHERE r.organization_id = _organization_id
    AND r.day >= _start_date
    AND r.day <= _end_date
    AND EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.id = auth.uid()
        AND cu.organization_id = _organization_id
    )
  ORDER BY r.day;
$$;