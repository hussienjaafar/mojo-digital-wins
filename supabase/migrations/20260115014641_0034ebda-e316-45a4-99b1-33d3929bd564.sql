-- Fix ActBlue RPCs to allow System Admin access
-- The deployed functions are missing the admin role check

-- 1. Fix get_actblue_daily_rollup to include admin check
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
    AND (
      -- Allow admins to see all data
      public.has_role(auth.uid(), 'admin'::app_role)
      OR 
      -- Or users who belong to the organization
      EXISTS (
        SELECT 1 FROM client_users cu
        WHERE cu.id = auth.uid()
          AND cu.organization_id = _organization_id
      )
    )
  ORDER BY r.day;
$$;

-- 2. Fix get_actblue_period_summary to include admin check
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
    AND (
      -- Allow admins to see all data
      public.has_role(auth.uid(), 'admin'::app_role)
      OR 
      -- Or users who belong to the organization
      EXISTS (
        SELECT 1 FROM client_users cu
        WHERE cu.id = auth.uid()
          AND cu.organization_id = _organization_id
      )
    );
$$;

-- 3. Fix get_actblue_filtered_rollup to include admin check
CREATE OR REPLACE FUNCTION get_actblue_filtered_rollup(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT 'America/New_York'
)
RETURNS TABLE (
  day DATE,
  gross_raised NUMERIC,
  net_raised NUMERIC,
  refund_amount NUMERIC,
  transaction_count BIGINT,
  refund_count BIGINT,
  unique_donors BIGINT,
  recurring_count BIGINT,
  recurring_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.id = auth.uid()
        AND cu.organization_id = p_org_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied to organization data';
  END IF;

  RETURN QUERY
  WITH filtered_transactions AS (
    SELECT
      t.organization_id,
      t.amount,
      t.net_amount,
      t.fee,
      t.transaction_type,
      t.is_recurring,
      t.donor_id_hash,
      t.refcode,
      t.source_campaign,
      (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::DATE AS local_day
    FROM actblue_transactions t
    WHERE t.organization_id = p_org_id
      AND t.transaction_date >= (p_start_date::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      AND t.transaction_date < ((p_end_date + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE p_timezone AT TIME ZONE 'UTC')
      AND (
        p_campaign_id IS NULL
        OR t.refcode IN (
          SELECT mc.refcode
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
        OR t.source_campaign IN (
          SELECT mc.campaign_name
          FROM meta_campaigns mc
          WHERE mc.id = p_campaign_id
        )
      )
      AND (
        p_creative_id IS NULL
        OR t.refcode IN (
          SELECT mci.refcode
          FROM meta_creative_insights mci
          WHERE mci.id = p_creative_id
        )
      )
  )
  SELECT
    ft.local_day AS day,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS gross_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type IS DISTINCT FROM 'refund'
      THEN COALESCE(ft.net_amount, ft.amount - COALESCE(ft.fee, 0)) ELSE 0 END
    ), 0)::NUMERIC AS net_raised,
    COALESCE(SUM(
      CASE WHEN ft.transaction_type = 'refund'
      THEN ABS(COALESCE(ft.net_amount, ft.amount)) ELSE 0 END
    ), 0)::NUMERIC AS refund_amount,
    COUNT(*) FILTER (WHERE ft.transaction_type IS DISTINCT FROM 'refund') AS transaction_count,
    COUNT(*) FILTER (WHERE ft.transaction_type = 'refund') AS refund_count,
    COUNT(DISTINCT ft.donor_id_hash) AS unique_donors,
    COUNT(*) FILTER (WHERE ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund') AS recurring_count,
    COALESCE(SUM(
      CASE WHEN ft.is_recurring = TRUE AND ft.transaction_type IS DISTINCT FROM 'refund'
      THEN ft.amount ELSE 0 END
    ), 0)::NUMERIC AS recurring_amount
  FROM filtered_transactions ft
  GROUP BY ft.local_day
  ORDER BY ft.local_day;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_actblue_daily_rollup(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_actblue_period_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT) TO authenticated;