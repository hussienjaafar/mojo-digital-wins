-- Update RPCs to default to UTC boundaries (matching ActBlue's Fundraising Performance dashboard)
-- Adding p_use_utc parameter (default TRUE) to match ActBlue's UTC-based reporting

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_actblue_daily_rollup(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_period_summary(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(UUID, DATE, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_actblue_filtered_rollup(UUID, DATE, DATE, UUID, UUID, TEXT);

-- 1) get_actblue_daily_rollup with UTC default
CREATE FUNCTION public.get_actblue_daily_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_use_utc BOOLEAN DEFAULT TRUE
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
  -- Get org timezone for local mode
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  RETURN QUERY
  SELECT
    CASE 
      WHEN p_use_utc THEN DATE(t.transaction_date)
      ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
    END as day,
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
    AND CASE 
      WHEN p_use_utc THEN DATE(t.transaction_date)
      ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
    END BETWEEN p_start_date AND p_end_date
  GROUP BY CASE 
    WHEN p_use_utc THEN DATE(t.transaction_date)
    ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
  END
  ORDER BY day;
END;
$$;

-- 2) get_actblue_period_summary with UTC default
CREATE FUNCTION public.get_actblue_period_summary(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_use_utc BOOLEAN DEFAULT TRUE
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
    AND CASE 
      WHEN p_use_utc THEN DATE(t.transaction_date)
      ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
    END BETWEEN p_start_date AND p_end_date;
END;
$$;

-- 3) get_actblue_filtered_rollup with UTC default
CREATE FUNCTION public.get_actblue_filtered_rollup(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_use_utc BOOLEAN DEFAULT TRUE
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
  -- Use provided timezone or fall back to org timezone (only used when p_use_utc is FALSE)
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
    CASE 
      WHEN p_use_utc THEN DATE(t.transaction_date)
      ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
    END as day,
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
    AND CASE 
      WHEN p_use_utc THEN DATE(t.transaction_date)
      ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
    END BETWEEN p_start_date AND p_end_date
    AND (p_campaign_id IS NULL OR ca.switchboard_campaign_id = p_campaign_id)
  GROUP BY CASE 
    WHEN p_use_utc THEN DATE(t.transaction_date)
    ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
  END
  ORDER BY day;
END;
$$;

-- 4) get_actblue_dashboard_metrics with UTC default
CREATE FUNCTION public.get_actblue_dashboard_metrics(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id UUID DEFAULT NULL,
  p_creative_id UUID DEFAULT NULL,
  p_use_utc BOOLEAN DEFAULT TRUE
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
      AND CASE 
        WHEN p_use_utc THEN DATE(t.transaction_date)
        ELSE DATE(t.transaction_date AT TIME ZONE v_timezone)
      END BETWEEN p_start_date AND p_end_date
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
      CASE 
        WHEN p_use_utc THEN DATE(transaction_date)
        ELSE DATE(transaction_date AT TIME ZONE v_timezone)
      END as day,
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
    GROUP BY CASE 
      WHEN p_use_utc THEN DATE(transaction_date)
      ELSE DATE(transaction_date AT TIME ZONE v_timezone)
    END
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
    'timezone', CASE WHEN p_use_utc THEN 'UTC' ELSE v_timezone END,
    'use_utc', p_use_utc
  ) INTO v_result;

  RETURN v_result;
END;
$$;