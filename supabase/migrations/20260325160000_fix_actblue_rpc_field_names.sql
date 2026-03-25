-- Fix ActBlue RPC field names to match frontend expectations
-- The database currently returns: gross_raised, net_raised, refund_amount, transaction_count
-- The frontend expects: gross_donations, net_donations, refunds, donation_count (daily rollup)
--                       total_gross_donations, total_net_donations, total_refunds, etc. (period summary)
--
-- This migration replaces both functions with the correct field names.

-- ============================================================================
-- 1) Fix get_actblue_daily_rollup
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_actblue_daily_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  day DATE,
  gross_donations NUMERIC,
  net_donations NUMERIC,
  total_fees NUMERIC,
  refunds NUMERIC,
  net_revenue NUMERIC,
  donation_count INTEGER,
  refund_count INTEGER,
  recurring_count INTEGER,
  recurring_revenue NUMERIC,
  avg_donation NUMERIC,
  unique_donors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  RETURN QUERY
  SELECT
    DATE(t.transaction_date AT TIME ZONE v_timezone) as day,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_donations,
    COALESCE(SUM(t.net_amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as net_donations,
    COALESCE(SUM(t.fee) FILTER (WHERE t.transaction_type = 'donation'), 0) as total_fees,
    COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.transaction_type = 'refund'), 0) as refunds,
    COALESCE(SUM(t.net_amount) FILTER (WHERE t.transaction_type = 'donation'), 0)
      - COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.transaction_type = 'refund'), 0) as net_revenue,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as donation_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'refund')::INTEGER as refund_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true)::INTEGER as recurring_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true), 0) as recurring_revenue,
    CASE
      WHEN COUNT(*) FILTER (WHERE t.transaction_type = 'donation') > 0
      THEN COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) / COUNT(*) FILTER (WHERE t.transaction_type = 'donation')
      ELSE 0
    END as avg_donation,
    COUNT(DISTINCT t.donor_email) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as unique_donors
  FROM actblue_transactions t
  WHERE t.organization_id = p_organization_id
    AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(t.transaction_date AT TIME ZONE v_timezone)
  ORDER BY day;
END;
$$;

-- ============================================================================
-- 2) Fix get_actblue_period_summary
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_actblue_period_summary(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_gross_donations NUMERIC,
  total_net_donations NUMERIC,
  total_fees NUMERIC,
  total_refunds NUMERIC,
  total_net_revenue NUMERIC,
  total_donation_count INTEGER,
  total_refund_count INTEGER,
  total_recurring_count INTEGER,
  total_recurring_revenue NUMERIC,
  overall_avg_donation NUMERIC,
  total_unique_donors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  RETURN QUERY
  SELECT
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as total_gross_donations,
    COALESCE(SUM(t.net_amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as total_net_donations,
    COALESCE(SUM(t.fee) FILTER (WHERE t.transaction_type = 'donation'), 0) as total_fees,
    COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.transaction_type = 'refund'), 0) as total_refunds,
    COALESCE(SUM(t.net_amount) FILTER (WHERE t.transaction_type = 'donation'), 0)
      - COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.transaction_type = 'refund'), 0) as total_net_revenue,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as total_donation_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'refund')::INTEGER as total_refund_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true)::INTEGER as total_recurring_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true), 0) as total_recurring_revenue,
    CASE
      WHEN COUNT(*) FILTER (WHERE t.transaction_type = 'donation') > 0
      THEN COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) / COUNT(*) FILTER (WHERE t.transaction_type = 'donation')
      ELSE 0
    END as overall_avg_donation,
    COUNT(DISTINCT t.donor_email) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as total_unique_donors
  FROM actblue_transactions t
  WHERE t.organization_id = p_organization_id
    AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date;
END;
$$;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_actblue_daily_rollup(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_actblue_period_summary(UUID, DATE, DATE) TO authenticated, anon;
