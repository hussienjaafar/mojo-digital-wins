CREATE OR REPLACE FUNCTION public.get_actblue_dashboard_metrics(p_organization_id uuid, p_start_date date, p_end_date date, p_campaign_id text DEFAULT NULL::text, p_creative_id text DEFAULT NULL::text, p_use_utc boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_timezone TEXT;
  v_result JSON;
BEGIN
  SELECT COALESCE(org_timezone, 'America/New_York')
  INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;

  WITH filtered_transactions AS (
    SELECT t.*, rm.platform as mapped_platform
    FROM actblue_transactions t
    LEFT JOIN refcode_mappings rm 
      ON t.organization_id = rm.organization_id 
      AND LOWER(t.refcode) = LOWER(rm.refcode)
    LEFT JOIN campaign_attribution ca 
      ON ca.refcode = t.refcode 
      AND ca.organization_id = t.organization_id
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
          WHEN mapped_platform IS NOT NULL THEN mapped_platform
          WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
          WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
          WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%' THEN 'sms'
          WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%' THEN 'meta'
          WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' OR refcode ILIKE 'em%' THEN 'email'
          WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'organic'
          WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
          ELSE 'other'
        END,
        'other'
      ) as channel,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'donation'), 0) as revenue,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type = 'donation'), 0) as net_revenue,
      COUNT(*) FILTER (WHERE transaction_type = 'donation') as count,
      COUNT(DISTINCT donor_email) FILTER (WHERE transaction_type = 'donation') as donors
    FROM filtered_transactions
    GROUP BY 
      CASE
        WHEN mapped_platform IS NOT NULL THEN mapped_platform
        WHEN refcode2 IS NOT NULL AND refcode2 != '' THEN 'meta'
        WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%sms%' THEN 'sms'
        WHEN refcode ILIKE '%sms%' OR refcode ILIKE '%text%' OR refcode ILIKE 'txt%' THEN 'sms'
        WHEN refcode ILIKE '%fb%' OR refcode ILIKE '%facebook%' OR refcode ILIKE '%ig%' OR refcode ILIKE '%instagram%' OR refcode ILIKE '%meta%' THEN 'meta'
        WHEN refcode ILIKE '%email%' OR refcode ILIKE '%em_%' OR refcode ILIKE 'em%' THEN 'email'
        WHEN refcode ILIKE '%organic%' OR refcode ILIKE '%direct%' THEN 'organic'
        WHEN contribution_form IS NOT NULL AND LOWER(contribution_form) LIKE '%meta%' THEN 'meta'
        ELSE 'other'
      END
  )
  SELECT json_build_object(
    'summary', (SELECT row_to_json(s) FROM summary s),
    'daily', (SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json) FROM daily_data d),
    'channels', (SELECT COALESCE(json_agg(c), '[]'::json) FROM channel_data c),
    'timezone', v_timezone
  ) INTO v_result;

  RETURN v_result;
END;
$function$;