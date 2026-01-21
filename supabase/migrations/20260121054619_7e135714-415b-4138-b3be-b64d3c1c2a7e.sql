-- Update the get_sms_metrics RPC to include AI analysis fields in campaigns
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
  -- Parse dates
  v_start_date := p_start_date::DATE;
  v_end_date := p_end_date::DATE;
  v_days_diff := v_end_date - v_start_date;
  v_prev_end := v_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - v_days_diff * INTERVAL '1 day';

  -- Get current period summary from sms_campaigns
  SELECT jsonb_build_object(
    'totalDonations', COALESCE(SUM(conversions), 0),
    'totalRaised', COALESCE(SUM(amount_raised), 0),
    'totalNet', COALESCE(SUM(amount_raised - COALESCE(cost, 0)), 0),
    'uniqueDonors', 0, -- Not tracked in sms_campaigns
    'averageDonation', CASE WHEN SUM(conversions) > 0 THEN SUM(amount_raised) / SUM(conversions) ELSE 0 END,
    'recurringCount', 0,
    'totalSent', COALESCE(SUM(messages_sent), 0),
    'totalDelivered', COALESCE(SUM(messages_delivered), 0),
    'totalClicks', COALESCE(SUM(clicks), 0),
    'totalOptOuts', COALESCE(SUM(opt_outs), 0),
    'totalCost', COALESCE(SUM(cost), 0),
    'campaignCount', COUNT(*)
  )
  INTO v_summary
  FROM sms_campaigns
  WHERE organization_id = p_organization_id
    AND send_date >= v_start_date
    AND send_date <= v_end_date
    AND status != 'draft';

  -- Get previous period summary
  SELECT jsonb_build_object(
    'totalDonations', COALESCE(SUM(conversions), 0),
    'totalRaised', COALESCE(SUM(amount_raised), 0),
    'totalSent', COALESCE(SUM(messages_sent), 0),
    'totalDelivered', COALESCE(SUM(messages_delivered), 0),
    'totalClicks', COALESCE(SUM(clicks), 0),
    'totalOptOuts', COALESCE(SUM(opt_outs), 0),
    'totalCost', COALESCE(SUM(cost), 0)
  )
  INTO v_prev_summary
  FROM sms_campaigns
  WHERE organization_id = p_organization_id
    AND send_date >= v_prev_start
    AND send_date <= v_prev_end
    AND status != 'draft';

  -- Get campaigns with AI analysis fields
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'campaign_id', id,
      'campaign_name', COALESCE(campaign_name, extracted_refcode, id::text),
      'donations', COALESCE(conversions, 0),
      'raised', COALESCE(amount_raised, 0),
      'net', COALESCE(amount_raised - COALESCE(cost, 0), 0),
      'donors', 0,
      'cost', COALESCE(cost, 0),
      'sent', COALESCE(messages_sent, 0),
      'delivered', COALESCE(messages_delivered, 0),
      'clicks', COALESCE(clicks, 0),
      'optOuts', COALESCE(opt_outs, 0),
      'first_donation', NULL,
      'last_donation', send_date,
      'send_date', send_date,
      -- AI analysis fields
      'topic', topic,
      'topic_summary', topic_summary,
      'tone', tone,
      'urgency_level', urgency_level,
      'call_to_action', call_to_action,
      'key_themes', COALESCE(key_themes, ARRAY[]::text[]),
      'analyzed_at', analyzed_at
    )
    ORDER BY send_date DESC
  ), '[]'::jsonb)
  INTO v_campaigns
  FROM sms_campaigns
  WHERE organization_id = p_organization_id
    AND send_date >= v_start_date
    AND send_date <= v_end_date
    AND status != 'draft';

  -- Get daily metrics
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', d.date,
      'donations', COALESCE(d.donations, 0),
      'raised', COALESCE(d.raised, 0),
      'donors', 0,
      'sent', COALESCE(d.sent, 0),
      'delivered', COALESCE(d.delivered, 0),
      'clicks', COALESCE(d.clicks, 0),
      'optOuts', COALESCE(d.optOuts, 0),
      'cost', COALESCE(d.cost, 0),
      'amountRaised', COALESCE(d.raised, 0)
    )
    ORDER BY d.date
  ), '[]'::jsonb)
  INTO v_daily_metrics
  FROM (
    SELECT 
      send_date::date as date,
      SUM(conversions) as donations,
      SUM(amount_raised) as raised,
      SUM(messages_sent) as sent,
      SUM(messages_delivered) as delivered,
      SUM(clicks) as clicks,
      SUM(opt_outs) as optOuts,
      SUM(cost) as cost
    FROM sms_campaigns
    WHERE organization_id = p_organization_id
      AND send_date >= v_start_date
      AND send_date <= v_end_date
      AND status != 'draft'
    GROUP BY send_date::date
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
      'attributionMethod', 'sms_campaigns_direct'
    )
  );

  RETURN v_result;
END;
$$;