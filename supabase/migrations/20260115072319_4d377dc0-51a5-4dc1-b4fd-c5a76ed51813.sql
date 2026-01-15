-- First drop existing functions that have different return types
DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(UUID, DATE, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.debug_timezone_totals(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_sms_metrics(UUID, DATE, DATE);

-- Fix timezone bucketing: For timestamptz columns, use single AT TIME ZONE, not double
-- The actblue_transactions.transaction_date is timestamptz, so:
-- CORRECT: DATE(t.transaction_date AT TIME ZONE v_timezone)
-- WRONG:   DATE(t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)

-- 1) Fix get_actblue_daily_rollup
CREATE FUNCTION public.get_actblue_daily_rollup(
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

-- 2) Fix get_actblue_period_summary
CREATE FUNCTION public.get_actblue_period_summary(
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

-- 3) Fix get_actblue_filtered_rollup
CREATE FUNCTION public.get_actblue_filtered_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
)
RETURNS TABLE (
  day DATE,
  gross_raised NUMERIC,
  net_raised NUMERIC,
  total_fees NUMERIC,
  refund_amount NUMERIC,
  donation_count INTEGER,
  refund_count INTEGER,
  recurring_count INTEGER,
  recurring_amount NUMERIC,
  unique_donors INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  -- Use provided timezone or fall back to org timezone
  IF p_timezone IS NOT NULL AND p_timezone != '' THEN
    v_timezone := p_timezone;
  ELSE
    SELECT COALESCE(org_timezone, 'America/New_York')
    INTO v_timezone
    FROM client_organizations
    WHERE id = p_organization_id;
  END IF;

  RETURN QUERY
  SELECT
    DATE(t.transaction_date AT TIME ZONE v_timezone) as day,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_raised,
    COALESCE(SUM(t.net_amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as net_raised,
    COALESCE(SUM(t.fee) FILTER (WHERE t.transaction_type = 'donation'), 0) as total_fees,
    COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.transaction_type = 'refund'), 0) as refund_amount,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as donation_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'refund')::INTEGER as refund_count,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true)::INTEGER as recurring_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation' AND t.is_recurring = true), 0) as recurring_amount,
    COUNT(DISTINCT t.donor_email) FILTER (WHERE t.transaction_type = 'donation')::INTEGER as unique_donors
  FROM actblue_transactions t
  LEFT JOIN campaign_attribution ca ON ca.refcode = t.refcode AND ca.organization_id = t.organization_id
  WHERE t.organization_id = p_organization_id
    AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
    AND (p_campaign_id IS NULL OR ca.switchboard_campaign_id = p_campaign_id)
  GROUP BY DATE(t.transaction_date AT TIME ZONE v_timezone)
  ORDER BY day;
END;
$$;

-- 4) Fix get_actblue_dashboard_metrics
CREATE FUNCTION public.get_actblue_dashboard_metrics(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_result JSON;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  WITH filtered_transactions AS (
    SELECT t.*
    FROM actblue_transactions t
    LEFT JOIN campaign_attribution ca ON ca.refcode = t.refcode AND ca.organization_id = t.organization_id
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
      AND (p_campaign_id IS NULL OR ca.switchboard_campaign_id = p_campaign_id)
  ),
  summary AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) as gross_donations,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type = 'donation'), 0) as net_donations,
      COALESCE(SUM(fee) FILTER (WHERE transaction_type = 'donation'), 0) as total_fees,
      COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as refunds,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as donation_count,
      COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_count,
      COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) as recurring_count,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true), 0) as recurring_revenue,
      COUNT(DISTINCT donor_email) FILTER (WHERE transaction_type = 'donation') as unique_donors
    FROM filtered_transactions
  ),
  daily_data AS (
    SELECT
      DATE(transaction_date AT TIME ZONE v_timezone) as day,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) as gross_donations,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type = 'donation'), 0) as net_donations,
      COALESCE(SUM(fee) FILTER (WHERE transaction_type = 'donation'), 0) as fees,
      COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'refund'), 0) as refunds,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as donation_count,
      COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_count,
      COUNT(*) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true) as recurring_count,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation' AND is_recurring = true), 0) as recurring_revenue,
      COUNT(DISTINCT donor_email) FILTER (WHERE transaction_type = 'donation') as unique_donors
    FROM filtered_transactions
    GROUP BY DATE(transaction_date AT TIME ZONE v_timezone)
    ORDER BY day
  ),
  channel_data AS (
    SELECT
      COALESCE(
        CASE
          WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' THEN 'SMS'
          WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' THEN 'Email'
          WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' THEN 'Paid Social'
          WHEN refcode ILIKE '%google%' OR refcode ILIKE '%ggl%' OR refcode ILIKE '%sem%' THEN 'Paid Search'
          WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'Organic'
          ELSE 'Other'
        END,
        'Other'
      ) as channel,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) as revenue,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as count
    FROM filtered_transactions
    GROUP BY 1
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(s) FROM summary s),
    'daily', (SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json) FROM daily_data d),
    'channels', (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM channel_data c),
    'timezone', v_timezone
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5) Fix debug_timezone_totals to compare UTC vs correct local
CREATE FUNCTION public.debug_timezone_totals(
  p_org_id UUID,
  p_date DATE
)
RETURNS TABLE (
  method TEXT,
  donation_count BIGINT,
  gross_amount NUMERIC,
  org_timezone TEXT
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
  WHERE id = p_org_id;

  RETURN QUERY
  -- Method 1: Pure UTC date (transaction_date::date)
  SELECT
    'utc_date'::TEXT as method,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation') as donation_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_amount,
    v_timezone as org_timezone
  FROM actblue_transactions t
  WHERE t.organization_id = p_org_id
    AND t.transaction_date::DATE = p_date
  UNION ALL
  -- Method 2: Correct local timezone conversion for timestamptz
  SELECT
    'local_timezone'::TEXT as method,
    COUNT(*) FILTER (WHERE t.transaction_type = 'donation') as donation_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type = 'donation'), 0) as gross_amount,
    v_timezone as org_timezone
  FROM actblue_transactions t
  WHERE t.organization_id = p_org_id
    AND DATE(t.transaction_date AT TIME ZONE v_timezone) = p_date;
END;
$$;

-- 6) Fix get_sms_metrics - use correct timezone and fix column references
CREATE FUNCTION public.get_sms_metrics(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_result JSON;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  WITH campaign_metrics AS (
    SELECT
      s.id,
      s.campaign_name,
      DATE(s.send_date AT TIME ZONE v_timezone) as send_day,
      COALESCE(s.messages_sent, 0) as messages_sent,
      COALESCE(s.messages_delivered, 0) as messages_delivered,
      COALESCE(s.clicks, 0) as clicks,
      COALESCE(s.optouts, 0) as optouts,
      COALESCE(s.cost, 0) as cost,
      COALESCE(s.revenue, 0) as revenue,
      COALESCE(s.donations, 0) as donations
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  ),
  summary AS (
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(optouts), 0) as total_optouts,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(donations), 0) as total_donations,
      COUNT(DISTINCT id) as campaign_count
    FROM campaign_metrics
  ),
  daily_data AS (
    SELECT
      send_day as day,
      SUM(messages_sent) as messages_sent,
      SUM(messages_delivered) as messages_delivered,
      SUM(clicks) as clicks,
      SUM(optouts) as optouts,
      SUM(cost) as cost,
      SUM(revenue) as revenue,
      SUM(donations) as donations
    FROM campaign_metrics
    GROUP BY send_day
    ORDER BY send_day
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(s) FROM summary s),
    'daily', (SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json) FROM daily_data d),
    'timezone', v_timezone
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_actblue_daily_rollup(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_actblue_period_summary(UUID, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_actblue_dashboard_metrics(UUID, DATE, DATE, UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.debug_timezone_totals(UUID, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_sms_metrics(UUID, DATE, DATE) TO authenticated, anon;