-- Complete overhaul of get_sms_metrics to include SMS-attributed donations from ActBlue transactions
-- This version computes "raised" and "conversions" from actblue_transactions using refcode patterns
-- that indicate SMS origin (txt*, TXT*, sms*, SMS*)

CREATE OR REPLACE FUNCTION public.get_sms_metrics(
  p_organization_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_timezone text;
  v_prev_start date;
  v_prev_end date;
  v_period_days int;
BEGIN
  -- Get organization timezone
  SELECT COALESCE(timezone, 'America/New_York') INTO v_timezone
  FROM client_organizations
  WHERE id = p_organization_id;
  
  IF v_timezone IS NULL THEN
    v_timezone := 'America/New_York';
  END IF;
  
  -- Calculate previous period for comparison
  v_period_days := p_end_date - p_start_date;
  v_prev_start := p_start_date - v_period_days - 1;
  v_prev_end := p_start_date - 1;

  WITH 
  -- SMS-attributed donations from actblue_transactions (using refcode patterns)
  sms_donations AS (
    SELECT
      DATE(t.transaction_date AT TIME ZONE v_timezone) as txn_date,
      t.refcode,
      t.amount,
      COALESCE(t.net_amount, t.amount * 0.961) as net_amount,
      t.donor_email
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
      AND (
        LOWER(t.refcode) LIKE 'txt%' OR
        LOWER(t.refcode) LIKE 'sms%' OR
        LOWER(t.refcode) LIKE '%_txt%' OR
        LOWER(t.refcode) LIKE '%_sms%'
      )
  ),
  
  -- Previous period SMS donations for trend comparison
  prev_sms_donations AS (
    SELECT
      t.amount,
      COALESCE(t.net_amount, t.amount * 0.961) as net_amount,
      t.donor_email
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN v_prev_start AND v_prev_end
      AND (
        LOWER(t.refcode) LIKE 'txt%' OR
        LOWER(t.refcode) LIKE 'sms%' OR
        LOWER(t.refcode) LIKE '%_txt%' OR
        LOWER(t.refcode) LIKE '%_sms%'
      )
  ),
  
  -- Aggregate donations by refcode (campaign proxy)
  donation_by_refcode AS (
    SELECT
      refcode,
      COUNT(*) as donations,
      COUNT(DISTINCT donor_email) as donors,
      SUM(amount) as raised,
      SUM(net_amount) as net,
      MIN(txn_date) as first_donation,
      MAX(txn_date) as last_donation
    FROM sms_donations
    GROUP BY refcode
  ),
  
  -- Daily donation metrics
  daily_donations AS (
    SELECT
      txn_date as day,
      COUNT(*) as donations,
      COUNT(DISTINCT donor_email) as donors,
      SUM(amount) as raised
    FROM sms_donations
    GROUP BY txn_date
  ),
  
  -- SMS platform campaign data (for send metrics)
  campaign_data AS (
    SELECT
      s.id,
      s.campaign_name,
      s.messages_sent,
      s.messages_delivered,
      s.clicks,
      s.opt_outs,
      s.cost,
      s.amount_raised as platform_raised,
      s.conversions as platform_conversions,
      DATE(s.send_date AT TIME ZONE v_timezone) as send_date
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  ),
  
  -- Daily send metrics from SMS platform
  daily_sends AS (
    SELECT
      send_date as day,
      SUM(COALESCE(messages_sent, 0)) as sent,
      SUM(COALESCE(messages_delivered, 0)) as delivered,
      SUM(COALESCE(clicks, 0)) as clicks,
      SUM(COALESCE(cost, 0)) as cost
    FROM campaign_data
    GROUP BY send_date
  ),
  
  -- Combined daily data
  all_days AS (
    SELECT DISTINCT day FROM daily_donations
    UNION
    SELECT DISTINCT day FROM daily_sends
  ),
  
  combined_daily AS (
    SELECT
      d.day,
      COALESCE(ds.sent, 0) as sent,
      COALESCE(ds.delivered, 0) as delivered,
      COALESCE(ds.clicks, 0) as clicks,
      COALESCE(ds.cost, 0) as cost,
      COALESCE(dd.donations, 0) as donations,
      COALESCE(dd.donors, 0) as donors,
      COALESCE(dd.raised, 0) as raised
    FROM all_days d
    LEFT JOIN daily_sends ds ON ds.day = d.day
    LEFT JOIN daily_donations dd ON dd.day = d.day
  ),
  
  -- Summary calculations
  current_summary AS (
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(cost), 0) as total_cost
    FROM campaign_data
  ),
  
  current_donations_summary AS (
    SELECT
      COALESCE(SUM(amount), 0) as total_raised,
      COUNT(*) as total_donations,
      COUNT(DISTINCT donor_email) as unique_donors
    FROM sms_donations
  ),
  
  prev_donations_summary AS (
    SELECT
      COALESCE(SUM(amount), 0) as total_raised,
      COUNT(*) as total_donations,
      COUNT(DISTINCT donor_email) as unique_donors
    FROM prev_sms_donations
  ),
  
  -- Previous period platform metrics
  prev_platform_summary AS (
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(cost), 0) as total_cost
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN v_prev_start AND v_prev_end
  )
  
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'totalDonations', cds.total_donations,
        'totalRaised', cds.total_raised,
        'totalNet', cds.total_raised * 0.961,
        'uniqueDonors', cds.unique_donors,
        'averageDonation', CASE WHEN cds.total_donations > 0 THEN cds.total_raised / cds.total_donations ELSE 0 END,
        'totalSent', cs.total_sent,
        'totalDelivered', cs.total_delivered,
        'totalClicks', cs.total_clicks,
        'totalOptOuts', cs.total_opt_outs,
        'totalCost', cs.total_cost,
        'campaignCount', (SELECT COUNT(*) FROM campaign_data)
      )
      FROM current_summary cs, current_donations_summary cds
    ),
    'previousPeriod', (
      SELECT json_build_object(
        'totalDonations', pds.total_donations,
        'totalRaised', pds.total_raised,
        'totalNet', pds.total_raised * 0.961,
        'uniqueDonors', pds.unique_donors,
        'totalSent', pps.total_sent,
        'totalDelivered', pps.total_delivered,
        'totalClicks', pps.total_clicks,
        'totalOptOuts', pps.total_opt_outs,
        'totalCost', pps.total_cost
      )
      FROM prev_platform_summary pps, prev_donations_summary pds
    ),
    'trends', (
      SELECT json_build_object(
        'raisedTrend', CASE 
          WHEN (SELECT total_raised FROM prev_donations_summary) = 0 THEN 
            CASE WHEN (SELECT total_raised FROM current_donations_summary) > 0 THEN 100.0 ELSE 0.0 END
          ELSE ((SELECT total_raised FROM current_donations_summary) - (SELECT total_raised FROM prev_donations_summary)) 
               / (SELECT total_raised FROM prev_donations_summary) * 100.0
        END,
        'donationsTrend', CASE 
          WHEN (SELECT total_donations FROM prev_donations_summary) = 0 THEN 
            CASE WHEN (SELECT total_donations FROM current_donations_summary) > 0 THEN 100.0 ELSE 0.0 END
          ELSE ((SELECT total_donations FROM current_donations_summary)::numeric - (SELECT total_donations FROM prev_donations_summary)::numeric) 
               / (SELECT total_donations FROM prev_donations_summary)::numeric * 100.0
        END,
        'sentTrend', CASE 
          WHEN (SELECT total_sent FROM prev_platform_summary) = 0 THEN 
            CASE WHEN (SELECT total_sent FROM current_summary) > 0 THEN 100.0 ELSE 0.0 END
          ELSE ((SELECT total_sent FROM current_summary)::numeric - (SELECT total_sent FROM prev_platform_summary)::numeric) 
               / (SELECT total_sent FROM prev_platform_summary)::numeric * 100.0
        END
      )
    ),
    'campaigns', (
      SELECT COALESCE(json_agg(json_build_object(
        'campaign_id', d.refcode,
        'campaign_name', d.refcode,
        'donations', d.donations,
        'donors', d.donors,
        'raised', d.raised,
        'net', d.net,
        'cost', 0,
        'sent', 0,
        'clicks', 0,
        'optOuts', 0,
        'first_donation', d.first_donation,
        'last_donation', d.last_donation
      ) ORDER BY d.raised DESC), '[]'::json)
      FROM donation_by_refcode d
    ),
    'dailyMetrics', (
      SELECT COALESCE(json_agg(json_build_object(
        'date', cd.day,
        'donations', cd.donations,
        'donors', cd.donors,
        'raised', cd.raised,
        'sent', cd.sent,
        'delivered', cd.delivered,
        'clicks', cd.clicks,
        'cost', cd.cost
      ) ORDER BY cd.day), '[]'::json)
      FROM combined_daily cd
    ),
    'metadata', json_build_object(
      'timezone', v_timezone,
      'startDate', p_start_date,
      'endDate', p_end_date,
      'previousStartDate', v_prev_start,
      'previousEndDate', v_prev_end,
      'generatedAt', NOW(),
      'attributionMethod', 'refcode_pattern',
      'refcodePatterns', ARRAY['txt%', 'sms%', '%_txt%', '%_sms%']
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;