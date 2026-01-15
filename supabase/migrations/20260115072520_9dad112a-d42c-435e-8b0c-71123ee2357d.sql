-- Fix type mismatch: switchboard_campaign_id is TEXT, p_campaign_id is UUID
DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(uuid, date, date, uuid, uuid);

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
  SELECT COALESCE(co.org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations co
  WHERE co.id = p_organization_id;

  WITH filtered_transactions AS (
    SELECT t.*
    FROM actblue_transactions t
    LEFT JOIN campaign_attribution ca ON ca.refcode = t.refcode AND ca.organization_id = t.organization_id
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
      AND (p_campaign_id IS NULL OR ca.switchboard_campaign_id = p_campaign_id::TEXT)
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
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as donation_count
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
          WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' THEN 'Paid Social'
          ELSE 'Other'
        END, 'Other'
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

GRANT EXECUTE ON FUNCTION public.get_actblue_dashboard_metrics(UUID, DATE, DATE, UUID, UUID) TO authenticated, anon;