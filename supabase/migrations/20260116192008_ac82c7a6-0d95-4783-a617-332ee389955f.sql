-- Complete overhaul of get_sms_metrics RPC to match frontend expectations
-- Returns camelCase keys, campaigns array, previous period data, and SMS-specific fields

CREATE OR REPLACE FUNCTION public.get_sms_metrics(
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
  v_period_days INT;
  v_prev_start DATE;
  v_prev_end DATE;
BEGIN
  -- Get organization timezone
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  -- Calculate previous period (same length as current period)
  v_period_days := p_end_date - p_start_date;
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - v_period_days;

  WITH campaign_metrics AS (
    -- Current period campaign data
    SELECT
      s.id,
      s.campaign_name,
      DATE(s.send_date AT TIME ZONE v_timezone) as send_day,
      s.send_date,
      COALESCE(s.messages_sent, 0) as messages_sent,
      COALESCE(s.messages_delivered, 0) as messages_delivered,
      COALESCE(s.clicks, 0) as clicks,
      COALESCE(s.opt_outs, 0) as opt_outs,
      COALESCE(s.cost, 0) as cost,
      COALESCE(s.amount_raised, 0) as amount_raised,
      COALESCE(s.conversions, 0) as conversions
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  ),
  previous_period AS (
    -- Previous period summary for trends
    SELECT
      COALESCE(SUM(s.amount_raised), 0) as total_raised,
      COALESCE(SUM(s.conversions), 0) as total_conversions,
      COALESCE(SUM(s.messages_sent), 0) as total_sent,
      COALESCE(SUM(s.messages_delivered), 0) as total_delivered,
      COALESCE(SUM(s.clicks), 0) as total_clicks,
      COALESCE(SUM(s.opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(s.cost), 0) as total_cost
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN v_prev_start AND v_prev_end
  ),
  summary AS (
    -- Current period summary
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(amount_raised), 0) as total_raised,
      COALESCE(SUM(conversions), 0) as total_conversions,
      COUNT(DISTINCT id) as campaign_count
    FROM campaign_metrics
  ),
  daily_data AS (
    -- Daily rollup for trend charts
    SELECT
      send_day as day,
      SUM(messages_sent) as messages_sent,
      SUM(messages_delivered) as messages_delivered,
      SUM(clicks) as clicks,
      SUM(opt_outs) as opt_outs,
      SUM(cost) as cost,
      SUM(amount_raised) as amount_raised,
      SUM(conversions) as conversions
    FROM campaign_metrics
    GROUP BY send_day
    ORDER BY send_day
  )
  SELECT json_build_object(
    -- Summary with camelCase keys matching SMSMetricsData interface
    'summary', (
      SELECT json_build_object(
        'totalDonations', s.total_conversions,
        'totalRaised', s.total_raised,
        'totalNet', s.total_raised - s.total_cost,
        'uniqueDonors', s.total_conversions,
        'averageDonation', CASE WHEN s.total_conversions > 0 
          THEN ROUND((s.total_raised / s.total_conversions)::numeric, 2) ELSE 0 END,
        'recurringCount', 0,
        -- SMS-specific fields
        'totalSent', s.total_sent,
        'totalDelivered', s.total_delivered,
        'totalClicks', s.total_clicks,
        'totalOptOuts', s.total_opt_outs,
        'totalCost', s.total_cost,
        'campaignCount', s.campaign_count
      )
      FROM summary s
    ),
    -- Previous period for trend calculations
    'previousPeriod', (
      SELECT json_build_object(
        'totalDonations', p.total_conversions,
        'totalRaised', p.total_raised,
        'totalSent', p.total_sent,
        'totalDelivered', p.total_delivered,
        'totalClicks', p.total_clicks,
        'totalOptOuts', p.total_opt_outs,
        'totalCost', p.total_cost
      )
      FROM previous_period p
    ),
    -- Calculated trends
    'trends', (
      SELECT json_build_object(
        'raisedTrend', CASE WHEN prev.total_raised > 0 
          THEN ROUND(((curr.total_raised - prev.total_raised) / prev.total_raised * 100)::numeric, 1)
          ELSE CASE WHEN curr.total_raised > 0 THEN 100 ELSE 0 END END,
        'donationsTrend', CASE WHEN prev.total_conversions > 0 
          THEN ROUND(((curr.total_conversions - prev.total_conversions) / prev.total_conversions * 100)::numeric, 1)
          ELSE CASE WHEN curr.total_conversions > 0 THEN 100 ELSE 0 END END
      )
      FROM summary curr, previous_period prev
    ),
    -- Campaigns array with detailed per-campaign data
    'campaigns', (
      SELECT COALESCE(json_agg(json_build_object(
        'campaign_id', c.id,
        'campaign_name', c.campaign_name,
        'donations', c.conversions,
        'raised', c.amount_raised,
        'net', c.amount_raised - c.cost,
        'donors', c.conversions,
        'cost', c.cost,
        'sent', c.messages_sent,
        'delivered', c.messages_delivered,
        'clicks', c.clicks,
        'optOuts', c.opt_outs,
        'first_donation', c.send_date,
        'last_donation', c.send_date
      ) ORDER BY c.send_date DESC), '[]'::json)
      FROM campaign_metrics c
    ),
    -- Daily metrics for charts
    'dailyMetrics', (
      SELECT COALESCE(json_agg(json_build_object(
        'date', d.day,
        'donations', d.conversions,
        'raised', d.amount_raised,
        'donors', d.conversions,
        'sent', d.messages_sent,
        'delivered', d.messages_delivered,
        'clicks', d.clicks,
        'optOuts', d.opt_outs,
        'cost', d.cost
      ) ORDER BY d.day), '[]'::json)
      FROM daily_data d
    ),
    -- Metadata
    'metadata', json_build_object(
      'timezone', v_timezone,
      'startDate', p_start_date,
      'endDate', p_end_date,
      'previousStartDate', v_prev_start,
      'previousEndDate', v_prev_end,
      'generatedAt', NOW()
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;