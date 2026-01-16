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
BEGIN
  -- Get organization timezone
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
      COALESCE(s.opt_outs, 0) as opt_outs,
      COALESCE(s.cost, 0) as cost,
      COALESCE(s.amount_raised, 0) as amount_raised,
      COALESCE(s.conversions, 0) as conversions
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  ),
  summary AS (
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
    'summary', (SELECT row_to_json(s) FROM summary s),
    'daily', (SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.day), '[]'::json) FROM daily_data d),
    'timezone', v_timezone
  ) INTO v_result;

  RETURN v_result;
END;
$$;