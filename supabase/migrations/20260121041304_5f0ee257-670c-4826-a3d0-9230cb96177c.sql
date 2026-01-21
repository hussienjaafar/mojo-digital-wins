-- Enhanced get_sms_metrics that detects SMS donations by contribution_form AND refcode patterns
-- Also returns sms_campaigns as the canonical campaign list (not just donation-grouped refcodes)

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
  -- SMS-attributed donations: detect by BOTH refcode patterns AND contribution_form containing 'sms' or 'text'
  sms_donations AS (
    SELECT
      t.id as transaction_id,
      DATE(t.transaction_date AT TIME ZONE v_timezone) as txn_date,
      t.transaction_date,
      t.refcode,
      t.contribution_form,
      t.amount,
      COALESCE(t.net_amount, t.amount * 0.961) as net_amount,
      t.donor_email,
      -- Detection method for debugging
      CASE 
        WHEN LOWER(t.refcode) LIKE 'txt%' OR LOWER(t.refcode) LIKE 'sms%' 
             OR LOWER(t.refcode) LIKE '%_txt%' OR LOWER(t.refcode) LIKE '%_sms%' THEN 'refcode_pattern'
        WHEN LOWER(t.contribution_form) LIKE '%sms%' OR LOWER(t.contribution_form) LIKE '%text%' THEN 'form_pattern'
        ELSE 'other'
      END as detection_method
    FROM actblue_transactions t
    WHERE t.organization_id = p_organization_id
      AND DATE(t.transaction_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
      AND (
        -- Original refcode patterns
        LOWER(t.refcode) LIKE 'txt%' OR
        LOWER(t.refcode) LIKE 'sms%' OR
        LOWER(t.refcode) LIKE '%_txt%' OR
        LOWER(t.refcode) LIKE '%_sms%' OR
        -- NEW: Contribution form contains 'sms' or 'text' (for forms like moliticosms, ahamawytext)
        LOWER(t.contribution_form) LIKE '%sms%' OR
        LOWER(t.contribution_form) LIKE '%text%'
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
        LOWER(t.refcode) LIKE '%_sms%' OR
        LOWER(t.contribution_form) LIKE '%sms%' OR
        LOWER(t.contribution_form) LIKE '%text%'
      )
  ),
  
  -- SMS platform campaigns (canonical campaign list)
  campaign_data AS (
    SELECT
      s.id,
      s.campaign_name,
      s.extracted_refcode,
      s.messages_sent,
      s.messages_delivered,
      s.clicks,
      s.opt_outs,
      s.cost,
      s.amount_raised as platform_raised,
      s.conversions as platform_conversions,
      s.send_date,
      DATE(s.send_date AT TIME ZONE v_timezone) as send_date_local
    FROM sms_campaigns s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.send_date AT TIME ZONE v_timezone) BETWEEN p_start_date AND p_end_date
  ),
  
  -- Match donations to campaigns using tiered matching:
  -- 1. Date-coded refcode (YYYYMMDD prefix) within ±1 day of campaign send_date
  -- 2. Token match (e.g., AAMA in refcode matches aama in extracted_refcode)
  -- 3. Contribution form fallback (form name contains campaign token)
  campaign_donations AS (
    SELECT 
      c.id as campaign_id,
      c.campaign_name,
      sd.transaction_id,
      sd.amount,
      sd.net_amount,
      sd.donor_email,
      sd.txn_date,
      -- Match scoring
      CASE 
        -- Date-coded refcode match: refcode starts with YYYYMMDD and date is within ±1 day
        WHEN sd.refcode ~ '^20[0-9]{6}' 
             AND ABS(DATE(TO_TIMESTAMP(LEFT(sd.refcode, 8), 'YYYYMMDD')) - c.send_date_local) <= 1 THEN 100
        -- Token match: last part of refcode (after date) matches extracted_refcode
        WHEN sd.refcode ~ '^20[0-9]{6}' 
             AND c.extracted_refcode IS NOT NULL
             AND LOWER(SUBSTRING(sd.refcode FROM 9)) = LOWER(c.extracted_refcode) THEN 90
        -- Partial token match
        WHEN c.extracted_refcode IS NOT NULL 
             AND LENGTH(c.extracted_refcode) >= 3
             AND (LOWER(sd.refcode) LIKE '%' || LOWER(c.extracted_refcode) || '%'
                  OR LOWER(c.extracted_refcode) LIKE '%' || LOWER(COALESCE(SUBSTRING(sd.refcode FROM 9), '')) || '%') THEN 70
        ELSE 0
      END as match_score
    FROM sms_donations sd
    CROSS JOIN campaign_data c
  ),
  
  -- Best match per donation (highest score, preferring earlier campaign on tie)
  best_matches AS (
    SELECT DISTINCT ON (transaction_id)
      campaign_id,
      campaign_name,
      transaction_id,
      amount,
      net_amount,
      donor_email,
      txn_date,
      match_score
    FROM campaign_donations
    WHERE match_score > 0
    ORDER BY transaction_id, match_score DESC, campaign_id
  ),
  
  -- Aggregate matched donations per campaign
  campaign_attribution AS (
    SELECT
      campaign_id,
      COUNT(*) as donations,
      COUNT(DISTINCT donor_email) as donors,
      SUM(amount) as raised,
      SUM(net_amount) as net,
      MIN(txn_date) as first_donation,
      MAX(txn_date) as last_donation
    FROM best_matches
    GROUP BY campaign_id
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
  
  -- Daily send metrics from SMS platform
  daily_sends AS (
    SELECT
      send_date_local as day,
      SUM(COALESCE(messages_sent, 0)) as sent,
      SUM(COALESCE(messages_delivered, 0)) as delivered,
      SUM(COALESCE(clicks, 0)) as clicks,
      SUM(COALESCE(cost, 0)) as cost
    FROM campaign_data
    GROUP BY send_date_local
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
  ),
  
  -- Attribution by detection method (for metadata)
  detection_breakdown AS (
    SELECT
      detection_method,
      COUNT(*) as count,
      SUM(amount) as amount
    FROM sms_donations
    GROUP BY detection_method
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
      -- Return sms_campaigns as the canonical list with attributed donation metrics
      SELECT COALESCE(json_agg(json_build_object(
        'campaign_id', c.id,
        'campaign_name', c.campaign_name,
        'extracted_refcode', c.extracted_refcode,
        'send_date', c.send_date_local,
        'donations', COALESCE(ca.donations, 0),
        'donors', COALESCE(ca.donors, 0),
        'raised', COALESCE(ca.raised, 0),
        'net', COALESCE(ca.net, 0),
        'cost', COALESCE(c.cost, 0),
        'sent', COALESCE(c.messages_sent, 0),
        'delivered', COALESCE(c.messages_delivered, 0),
        'clicks', COALESCE(c.clicks, 0),
        'optOuts', COALESCE(c.opt_outs, 0),
        'first_donation', ca.first_donation,
        'last_donation', ca.last_donation
      ) ORDER BY c.send_date DESC), '[]'::json)
      FROM campaign_data c
      LEFT JOIN campaign_attribution ca ON ca.campaign_id = c.id
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
      'attributionMethod', 'enhanced_form_and_refcode',
      'refcodePatterns', ARRAY['txt%', 'sms%', '%_txt%', '%_sms%'],
      'formPatterns', ARRAY['%sms%', '%text%'],
      'detectionBreakdown', (
        SELECT COALESCE(json_object_agg(detection_method, json_build_object('count', count, 'amount', amount)), '{}'::json)
        FROM detection_breakdown
      )
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;