-- Clean up and fix get_actblue_dashboard_metrics type mismatch
-- Drop ALL versions of these functions first

DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(UUID, DATE, DATE, UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_actblue_dashboard_metrics(UUID, DATE, DATE, TEXT, TEXT, BOOLEAN);

-- Recreate with TEXT types for campaign_id and creative_id (matching column types)
CREATE OR REPLACE FUNCTION public.get_actblue_dashboard_metrics(
  p_organization_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id TEXT DEFAULT NULL,
  p_creative_id TEXT DEFAULT NULL,
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