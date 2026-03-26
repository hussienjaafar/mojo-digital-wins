-- Rewrite get_sms_metrics to use attributed_channel from actblue_transactions
-- for donation data, while keeping sms_campaigns for engagement metrics (sent, clicks, cost)

CREATE OR REPLACE FUNCTION get_sms_metrics(
  p_organization_id UUID,
  p_start_date TEXT,
  p_end_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_summary JSONB;
  v_prev_summary JSONB;
  v_campaigns JSONB;
  v_daily_metrics JSONB;
  v_start_date DATE;
  v_end_date DATE;
  v_prev_start DATE;
  v_prev_end DATE;
  v_days_diff INTEGER;
BEGIN
  v_start_date := p_start_date::DATE;
  v_end_date := p_end_date::DATE;
  v_days_diff := v_end_date - v_start_date;
  v_prev_end := v_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - v_days_diff * INTERVAL '1 day';

  -- Current period summary: donations from actblue_transactions, engagement from sms_campaigns
  WITH donation_data AS (
    SELECT
      COALESCE(SUM(amount), 0) as total_raised,
      COALESCE(SUM(net_amount), 0) as total_net,
      COUNT(*) as total_donations,
      COUNT(DISTINCT donor_email) as unique_donors,
      CASE WHEN COUNT(*) > 0 THEN SUM(amount) / COUNT(*) ELSE 0 END as avg_donation
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND attributed_channel = 'sms'
      AND DATE(transaction_date) BETWEEN v_start_date AND v_end_date
      AND transaction_type = 'donation'
  ),
  engagement_data AS (
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(cost), 0) as total_cost,
      COUNT(*) as campaign_count
    FROM sms_campaigns
    WHERE organization_id = p_organization_id
      AND send_date >= v_start_date
      AND send_date <= v_end_date
      AND status != 'draft'
  )
  SELECT jsonb_build_object(
    'totalDonations', dd.total_donations,
    'totalRaised', dd.total_raised,
    'totalNet', dd.total_net,
    'uniqueDonors', dd.unique_donors,
    'averageDonation', dd.avg_donation,
    'recurringCount', 0,
    'totalSent', ed.total_sent,
    'totalDelivered', ed.total_delivered,
    'totalClicks', ed.total_clicks,
    'totalOptOuts', ed.total_opt_outs,
    'totalCost', ed.total_cost,
    'campaignCount', ed.campaign_count
  )
  INTO v_summary
  FROM donation_data dd, engagement_data ed;

  -- Previous period summary
  WITH prev_donations AS (
    SELECT
      COALESCE(SUM(amount), 0) as total_raised,
      COUNT(*) as total_donations
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND attributed_channel = 'sms'
      AND DATE(transaction_date) BETWEEN v_prev_start AND v_prev_end
      AND transaction_type = 'donation'
  ),
  prev_engagement AS (
    SELECT
      COALESCE(SUM(messages_sent), 0) as total_sent,
      COALESCE(SUM(messages_delivered), 0) as total_delivered,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(SUM(opt_outs), 0) as total_opt_outs,
      COALESCE(SUM(cost), 0) as total_cost
    FROM sms_campaigns
    WHERE organization_id = p_organization_id
      AND send_date >= v_prev_start
      AND send_date <= v_prev_end
      AND status != 'draft'
  )
  SELECT jsonb_build_object(
    'totalDonations', pd.total_donations,
    'totalRaised', pd.total_raised,
    'totalSent', pe.total_sent,
    'totalDelivered', pe.total_delivered,
    'totalClicks', pe.total_clicks,
    'totalOptOuts', pe.total_opt_outs,
    'totalCost', pe.total_cost
  )
  INTO v_prev_summary
  FROM prev_donations pd, prev_engagement pe;

  -- Per-campaign breakdown: join sms_campaigns with actblue_transactions
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'campaign_id', sc.id,
      'campaign_name', COALESCE(sc.campaign_name, sc.extracted_refcode, sc.id::text),
      'donations', COALESCE(tx.donation_count, 0),
      'raised', COALESCE(tx.raised, 0),
      'net', COALESCE(tx.raised - COALESCE(sc.cost, 0), 0),
      'donors', COALESCE(tx.unique_donors, 0),
      'cost', COALESCE(sc.cost, 0),
      'sent', COALESCE(sc.messages_sent, 0),
      'delivered', COALESCE(sc.messages_delivered, 0),
      'clicks', COALESCE(sc.clicks, 0),
      'optOuts', COALESCE(sc.opt_outs, 0),
      'send_date', sc.send_date,
      'topic', sc.topic,
      'topic_summary', sc.topic_summary,
      'tone', sc.tone,
      'urgency_level', sc.urgency_level,
      'call_to_action', sc.call_to_action,
      'key_themes', COALESCE(sc.key_themes, ARRAY[]::text[]),
      'analyzed_at', sc.analyzed_at
    )
    ORDER BY sc.send_date DESC
  ), '[]'::jsonb)
  INTO v_campaigns
  FROM sms_campaigns sc
  LEFT JOIN (
    SELECT
      sms_campaign_id,
      COUNT(*) as donation_count,
      COALESCE(SUM(amount), 0) as raised,
      COUNT(DISTINCT donor_email) as unique_donors
    FROM actblue_transactions
    WHERE organization_id = p_organization_id
      AND attributed_channel = 'sms'
      AND DATE(transaction_date) BETWEEN v_start_date AND v_end_date
      AND transaction_type = 'donation'
      AND sms_campaign_id IS NOT NULL
    GROUP BY sms_campaign_id
  ) tx ON tx.sms_campaign_id = sc.id
  WHERE sc.organization_id = p_organization_id
    AND sc.send_date >= v_start_date
    AND sc.send_date <= v_end_date
    AND sc.status != 'draft';

  -- Daily metrics: donations from actblue_transactions, engagement from sms_campaigns
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', d.day,
      'donations', COALESCE(d.donations, 0),
      'raised', COALESCE(d.raised, 0),
      'donors', COALESCE(d.donors, 0),
      'sent', COALESCE(d.sent, 0),
      'delivered', COALESCE(d.delivered, 0),
      'clicks', COALESCE(d.clicks, 0),
      'optOuts', COALESCE(d.opt_outs, 0),
      'cost', COALESCE(d.cost, 0),
      'amountRaised', COALESCE(d.raised, 0)
    )
    ORDER BY d.day
  ), '[]'::jsonb)
  INTO v_daily_metrics
  FROM (
    SELECT
      COALESCE(tx.day, sc.day) as day,
      COALESCE(tx.donations, 0) as donations,
      COALESCE(tx.raised, 0) as raised,
      COALESCE(tx.donors, 0) as donors,
      COALESCE(sc.sent, 0) as sent,
      COALESCE(sc.delivered, 0) as delivered,
      COALESCE(sc.clicks, 0) as clicks,
      COALESCE(sc.opt_outs, 0) as opt_outs,
      COALESCE(sc.cost, 0) as cost
    FROM (
      SELECT
        DATE(transaction_date) as day,
        COUNT(*) as donations,
        SUM(amount) as raised,
        COUNT(DISTINCT donor_email) as donors
      FROM actblue_transactions
      WHERE organization_id = p_organization_id
        AND attributed_channel = 'sms'
        AND DATE(transaction_date) BETWEEN v_start_date AND v_end_date
        AND transaction_type = 'donation'
      GROUP BY DATE(transaction_date)
    ) tx
    FULL OUTER JOIN (
      SELECT
        send_date::date as day,
        SUM(messages_sent) as sent,
        SUM(messages_delivered) as delivered,
        SUM(clicks) as clicks,
        SUM(opt_outs) as opt_outs,
        SUM(cost) as cost
      FROM sms_campaigns
      WHERE organization_id = p_organization_id
        AND send_date >= v_start_date
        AND send_date <= v_end_date
        AND status != 'draft'
      GROUP BY send_date::date
    ) sc ON tx.day = sc.day
  ) d;

  -- Build final result
  v_result := jsonb_build_object(
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'previousPeriod', COALESCE(v_prev_summary, '{}'::jsonb),
    'trends', jsonb_build_object(
      'raisedTrend', NULL,
      'donationsTrend', NULL
    ),
    'campaigns', COALESCE(v_campaigns, '[]'::jsonb),
    'dailyMetrics', COALESCE(v_daily_metrics, '[]'::jsonb),
    'metadata', jsonb_build_object(
      'timezone', 'America/New_York',
      'startDate', p_start_date,
      'endDate', p_end_date,
      'previousStartDate', v_prev_start::text,
      'previousEndDate', v_prev_end::text,
      'generatedAt', NOW(),
      'attributionMethod', 'unified_attributed_channel'
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sms_metrics(UUID, TEXT, TEXT) TO authenticated, anon;
