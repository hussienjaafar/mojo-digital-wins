-- =====================================================
-- UNIFIED ACTBLUE METRICS SYSTEM
-- Single source of truth for all ActBlue dashboard data
-- =====================================================

-- 1. Add timezone column to client_organizations (default Eastern for political orgs)
ALTER TABLE public.client_organizations 
ADD COLUMN IF NOT EXISTS org_timezone TEXT DEFAULT 'America/New_York';

-- 2. Create channel detection enum for type safety
DO $$ BEGIN
  CREATE TYPE public.attribution_channel AS ENUM ('meta', 'sms', 'email', 'other', 'unattributed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Create unified channel detection function
-- This is THE SINGLE SOURCE OF TRUTH for channel detection
CREATE OR REPLACE FUNCTION public.detect_donation_channel(
  p_contribution_form TEXT,
  p_refcode TEXT,
  p_source_campaign TEXT,
  p_click_id TEXT,
  p_fbclid TEXT,
  p_attributed_campaign_id TEXT DEFAULT NULL,
  p_attributed_ad_id TEXT DEFAULT NULL,
  p_attribution_method TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Priority 1: Explicit attribution from donation_attribution
  IF p_attribution_method IS NOT NULL THEN
    IF LOWER(p_attribution_method) LIKE '%sms%' THEN RETURN 'sms'; END IF;
    IF LOWER(p_attribution_method) LIKE '%meta%' OR LOWER(p_attribution_method) LIKE '%facebook%' THEN RETURN 'meta'; END IF;
    IF LOWER(p_attribution_method) LIKE '%email%' THEN RETURN 'email'; END IF;
  END IF;
  
  -- Priority 2: Meta campaign/ad IDs present
  IF p_attributed_campaign_id IS NOT NULL OR p_attributed_ad_id IS NOT NULL THEN
    RETURN 'meta';
  END IF;
  
  -- Priority 3: Meta click identifiers
  IF p_click_id IS NOT NULL OR p_fbclid IS NOT NULL THEN
    RETURN 'meta';
  END IF;
  
  -- Priority 4: Source campaign indicates Meta
  IF p_source_campaign IS NOT NULL AND LOWER(p_source_campaign) LIKE '%meta%' THEN
    RETURN 'meta';
  END IF;
  
  -- Priority 5: Contribution form indicates SMS (e.g., "mltcosms", "smithsms")
  IF p_contribution_form IS NOT NULL AND LOWER(p_contribution_form) LIKE '%sms%' THEN
    RETURN 'sms';
  END IF;
  
  -- Priority 6: Refcode patterns
  IF p_refcode IS NOT NULL THEN
    -- SMS refcode patterns
    IF LOWER(p_refcode) LIKE 'txt%' OR LOWER(p_refcode) LIKE 'sms%' THEN
      RETURN 'sms';
    END IF;
    -- Email refcode patterns
    IF LOWER(p_refcode) LIKE 'em%' OR LOWER(p_refcode) LIKE 'email%' THEN
      RETURN 'email';
    END IF;
    -- Has a refcode but no platform match = other attributed
    RETURN 'other';
  END IF;
  
  -- No attribution signals at all
  RETURN 'unattributed';
END;
$$;

-- 4. Create unified dashboard metrics RPC
-- Returns ALL metrics needed for client dashboard in one call
CREATE OR REPLACE FUNCTION public.get_actblue_dashboard_metrics(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_campaign_id TEXT DEFAULT NULL,
  p_creative_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT;
  v_prev_start DATE;
  v_prev_end DATE;
  v_period_days INT;
  v_result JSON;
BEGIN
  -- Get org timezone
  SELECT COALESCE(org_timezone, 'America/New_York') INTO v_timezone
  FROM client_organizations WHERE id = p_org_id;
  
  -- Calculate previous period for trends
  v_period_days := p_end_date - p_start_date + 1;
  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (v_period_days - 1);

  WITH 
  -- Base transaction data with channel detection
  base_txns AS (
    SELECT 
      t.id,
      t.transaction_date,
      (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE as local_date,
      t.amount,
      COALESCE(t.net_amount, t.amount - COALESCE(t.fee, 0)) as net_amount,
      COALESCE(t.fee, 0) as fee,
      t.is_recurring,
      t.donor_email,
      t.refcode,
      t.contribution_form,
      t.source_campaign,
      t.click_id,
      t.fbclid,
      t.transaction_type,
      public.detect_donation_channel(
        t.contribution_form,
        t.refcode,
        t.source_campaign,
        t.click_id,
        t.fbclid,
        da.attributed_campaign_id,
        da.attributed_ad_id,
        da.attribution_method
      ) as channel
    FROM actblue_transactions t
    LEFT JOIN donation_attribution da ON t.id = da.transaction_id
    WHERE t.organization_id = p_org_id
      AND t.transaction_date::DATE BETWEEN p_start_date AND p_end_date
      AND (p_campaign_id IS NULL OR da.attributed_campaign_id = p_campaign_id)
      AND (p_creative_id IS NULL OR da.attributed_creative_id = p_creative_id)
  ),
  
  -- Previous period for trends
  prev_txns AS (
    SELECT 
      t.amount,
      COALESCE(t.net_amount, t.amount - COALESCE(t.fee, 0)) as net_amount,
      t.donor_email,
      t.is_recurring,
      t.transaction_type
    FROM actblue_transactions t
    WHERE t.organization_id = p_org_id
      AND t.transaction_date::DATE BETWEEN v_prev_start AND v_prev_end
  ),
  
  -- Current period summary
  current_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as total_donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_net,
      COALESCE(SUM(fee) FILTER (WHERE transaction_type != 'refund'), 0) as total_fees,
      COUNT(DISTINCT donor_email) as unique_donors,
      COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type != 'refund') as recurring_count,
      COALESCE(SUM(amount) FILTER (WHERE is_recurring = true AND transaction_type != 'refund'), 0) as recurring_amount,
      COUNT(*) FILTER (WHERE transaction_type = 'refund') as refund_count,
      COALESCE(ABS(SUM(amount) FILTER (WHERE transaction_type = 'refund')), 0) as refund_amount
    FROM base_txns
  ),
  
  -- Previous period summary for trends
  prev_summary AS (
    SELECT
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as total_donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_net,
      COUNT(DISTINCT donor_email) as unique_donors,
      COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type != 'refund') as recurring_count,
      COALESCE(SUM(amount) FILTER (WHERE is_recurring = true AND transaction_type != 'refund'), 0) as recurring_amount
    FROM prev_txns
  ),
  
  -- Daily rollup with timezone-aware bucketing
  daily_rollup AS (
    SELECT
      local_date as date,
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as net,
      COUNT(DISTINCT donor_email) as donors,
      COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type != 'refund') as recurring_donations,
      COALESCE(SUM(amount) FILTER (WHERE is_recurring = true AND transaction_type != 'refund'), 0) as recurring_amount
    FROM base_txns
    GROUP BY local_date
    ORDER BY local_date
  ),
  
  -- Channel breakdown
  channel_breakdown AS (
    SELECT
      channel,
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as net,
      COUNT(DISTINCT donor_email) as donors
    FROM base_txns
    GROUP BY channel
  ),
  
  -- Attribution quality metrics
  attribution_quality AS (
    SELECT
      COUNT(*) FILTER (WHERE channel != 'unattributed') as attributed_count,
      COUNT(*) as total_count,
      CASE WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE channel != 'unattributed')::NUMERIC / COUNT(*)) * 100, 1)
        ELSE 0 
      END as attribution_rate
    FROM base_txns
    WHERE transaction_type != 'refund'
  )
  
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'totalDonations', total_donations,
        'totalRaised', total_raised,
        'totalNet', total_net,
        'totalFees', total_fees,
        'uniqueDonors', unique_donors,
        'averageDonation', CASE WHEN total_donations > 0 THEN ROUND(total_raised / total_donations, 2) ELSE 0 END,
        'recurringCount', recurring_count,
        'recurringAmount', recurring_amount,
        'recurringRate', CASE WHEN total_donations > 0 THEN ROUND((recurring_count::NUMERIC / total_donations) * 100, 1) ELSE 0 END,
        'refundCount', refund_count,
        'refundAmount', refund_amount,
        'refundRate', CASE WHEN total_donations > 0 THEN ROUND((refund_count::NUMERIC / total_donations) * 100, 1) ELSE 0 END
      ) FROM current_summary
    ),
    'previousPeriod', (
      SELECT json_build_object(
        'totalDonations', total_donations,
        'totalRaised', total_raised,
        'totalNet', total_net,
        'uniqueDonors', unique_donors,
        'recurringCount', recurring_count,
        'recurringAmount', recurring_amount
      ) FROM prev_summary
    ),
    'trends', (
      SELECT json_build_object(
        'raisedTrend', CASE WHEN ps.total_raised > 0 
          THEN ROUND(((cs.total_raised - ps.total_raised) / ps.total_raised) * 100, 1) 
          ELSE NULL END,
        'donationsTrend', CASE WHEN ps.total_donations > 0 
          THEN ROUND(((cs.total_donations - ps.total_donations)::NUMERIC / ps.total_donations) * 100, 1) 
          ELSE NULL END,
        'donorsTrend', CASE WHEN ps.unique_donors > 0 
          THEN ROUND(((cs.unique_donors - ps.unique_donors)::NUMERIC / ps.unique_donors) * 100, 1) 
          ELSE NULL END,
        'recurringTrend', CASE WHEN ps.recurring_amount > 0 
          THEN ROUND(((cs.recurring_amount - ps.recurring_amount) / ps.recurring_amount) * 100, 1) 
          ELSE NULL END
      ) FROM current_summary cs, prev_summary ps
    ),
    'dailyRollup', (SELECT COALESCE(json_agg(row_to_json(daily_rollup.*) ORDER BY date), '[]'::json) FROM daily_rollup),
    'channelBreakdown', (SELECT COALESCE(json_agg(row_to_json(channel_breakdown.*)), '[]'::json) FROM channel_breakdown),
    'attribution', (
      SELECT json_build_object(
        'attributedCount', attributed_count,
        'totalCount', total_count,
        'attributionRate', attribution_rate
      ) FROM attribution_quality
    ),
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

-- 5. Create SMS-specific metrics RPC using unified channel detection
CREATE OR REPLACE FUNCTION public.get_sms_metrics(
  p_org_id UUID,
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
  v_prev_start DATE;
  v_prev_end DATE;
  v_period_days INT;
  v_result JSON;
BEGIN
  -- Get org timezone
  SELECT COALESCE(org_timezone, 'America/New_York') INTO v_timezone
  FROM client_organizations WHERE id = p_org_id;
  
  -- Calculate previous period
  v_period_days := p_end_date - p_start_date + 1;
  v_prev_end := p_start_date - INTERVAL '1 day';
  v_prev_start := v_prev_end - (v_period_days - 1);

  WITH 
  sms_txns AS (
    SELECT 
      t.id,
      t.transaction_date,
      (t.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::DATE as local_date,
      t.amount,
      COALESCE(t.net_amount, t.amount - COALESCE(t.fee, 0)) as net_amount,
      t.refcode,
      t.contribution_form,
      t.donor_email,
      t.is_recurring,
      t.transaction_type
    FROM actblue_transactions t
    LEFT JOIN donation_attribution da ON t.id = da.transaction_id
    WHERE t.organization_id = p_org_id
      AND t.transaction_date::DATE BETWEEN p_start_date AND p_end_date
      AND public.detect_donation_channel(
        t.contribution_form,
        t.refcode,
        t.source_campaign,
        t.click_id,
        t.fbclid,
        da.attributed_campaign_id,
        da.attributed_ad_id,
        da.attribution_method
      ) = 'sms'
  ),
  
  prev_sms_txns AS (
    SELECT t.amount, t.donor_email, t.is_recurring, t.transaction_type
    FROM actblue_transactions t
    LEFT JOIN donation_attribution da ON t.id = da.transaction_id
    WHERE t.organization_id = p_org_id
      AND t.transaction_date::DATE BETWEEN v_prev_start AND v_prev_end
      AND public.detect_donation_channel(
        t.contribution_form,
        t.refcode,
        t.source_campaign,
        t.click_id,
        t.fbclid,
        da.attributed_campaign_id,
        da.attributed_ad_id,
        da.attribution_method
      ) = 'sms'
  ),
  
  -- Group by refcode or contribution_form as "campaigns"
  campaigns AS (
    SELECT
      COALESCE(NULLIF(refcode, ''), contribution_form, 'Unknown') as campaign_id,
      COALESCE(NULLIF(refcode, ''), contribution_form, 'Unknown SMS') as campaign_name,
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as net,
      COUNT(DISTINCT donor_email) as donors,
      MIN(local_date) as first_donation,
      MAX(local_date) as last_donation
    FROM sms_txns
    GROUP BY COALESCE(NULLIF(refcode, ''), contribution_form, 'Unknown')
  ),
  
  daily_metrics AS (
    SELECT
      local_date as date,
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as raised,
      COUNT(DISTINCT donor_email) as donors
    FROM sms_txns
    GROUP BY local_date
    ORDER BY local_date
  ),
  
  current_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as total_donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_raised,
      COALESCE(SUM(net_amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_net,
      COUNT(DISTINCT donor_email) as unique_donors,
      COUNT(*) FILTER (WHERE is_recurring = true AND transaction_type != 'refund') as recurring_count
    FROM sms_txns
  ),
  
  prev_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE transaction_type != 'refund') as total_donations,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type != 'refund'), 0) as total_raised
    FROM prev_sms_txns
  )
  
  SELECT json_build_object(
    'summary', (
      SELECT json_build_object(
        'totalDonations', total_donations,
        'totalRaised', total_raised,
        'totalNet', total_net,
        'uniqueDonors', unique_donors,
        'averageDonation', CASE WHEN total_donations > 0 THEN ROUND(total_raised / total_donations, 2) ELSE 0 END,
        'recurringCount', recurring_count
      ) FROM current_totals
    ),
    'previousPeriod', (
      SELECT json_build_object(
        'totalDonations', total_donations,
        'totalRaised', total_raised
      ) FROM prev_totals
    ),
    'trends', (
      SELECT json_build_object(
        'raisedTrend', CASE WHEN pt.total_raised > 0 
          THEN ROUND(((ct.total_raised - pt.total_raised) / pt.total_raised) * 100, 1) 
          ELSE NULL END,
        'donationsTrend', CASE WHEN pt.total_donations > 0 
          THEN ROUND(((ct.total_donations - pt.total_donations)::NUMERIC / pt.total_donations) * 100, 1) 
          ELSE NULL END
      ) FROM current_totals ct, prev_totals pt
    ),
    'campaigns', (SELECT COALESCE(json_agg(row_to_json(campaigns.*) ORDER BY raised DESC), '[]'::json) FROM campaigns),
    'dailyMetrics', (SELECT COALESCE(json_agg(row_to_json(daily_metrics.*) ORDER BY date), '[]'::json) FROM daily_metrics),
    'metadata', json_build_object(
      'timezone', v_timezone,
      'startDate', p_start_date,
      'endDate', p_end_date,
      'generatedAt', NOW()
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 6. Create client data health check RPC for onboarding validation
CREATE OR REPLACE FUNCTION public.check_client_data_health(
  p_org_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH 
  txn_stats AS (
    SELECT
      COUNT(*) as total_transactions,
      COUNT(*) FILTER (WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days') as last_30_days,
      MIN(transaction_date) as earliest_transaction,
      MAX(transaction_date) as latest_transaction,
      COUNT(DISTINCT refcode) FILTER (WHERE refcode IS NOT NULL) as unique_refcodes,
      COUNT(*) FILTER (WHERE refcode IS NOT NULL) as transactions_with_refcode,
      COUNT(DISTINCT contribution_form) as unique_forms
    FROM actblue_transactions
    WHERE organization_id = p_org_id
  ),
  
  channel_detection AS (
    SELECT
      public.detect_donation_channel(
        t.contribution_form,
        t.refcode,
        t.source_campaign,
        t.click_id,
        t.fbclid,
        da.attributed_campaign_id,
        da.attributed_ad_id,
        da.attribution_method
      ) as channel,
      COUNT(*) as count
    FROM actblue_transactions t
    LEFT JOIN donation_attribution da ON t.id = da.transaction_id
    WHERE t.organization_id = p_org_id
      AND t.transaction_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY 1
  ),
  
  sms_forms AS (
    SELECT DISTINCT contribution_form
    FROM actblue_transactions
    WHERE organization_id = p_org_id
      AND LOWER(contribution_form) LIKE '%sms%'
  ),
  
  meta_stats AS (
    SELECT
      COUNT(*) as meta_campaigns,
      COUNT(*) FILTER (WHERE is_active = true) as active_campaigns
    FROM meta_campaigns
    WHERE organization_id = p_org_id
  ),
  
  attribution_stats AS (
    SELECT
      COUNT(*) as total_attributed,
      COUNT(*) FILTER (WHERE is_deterministic = true) as deterministic,
      COUNT(*) FILTER (WHERE attribution_method LIKE '%sms%') as sms_attributed,
      COUNT(*) FILTER (WHERE attribution_method LIKE '%meta%') as meta_attributed
    FROM donation_attribution
    WHERE organization_id = p_org_id
  )
  
  SELECT json_build_object(
    'transactions', (SELECT row_to_json(txn_stats.*) FROM txn_stats),
    'channelBreakdown', (SELECT COALESCE(json_agg(row_to_json(channel_detection.*)), '[]'::json) FROM channel_detection),
    'smsFormsDetected', (SELECT COALESCE(json_agg(contribution_form), '[]'::json) FROM sms_forms),
    'metaCampaigns', (SELECT row_to_json(meta_stats.*) FROM meta_stats),
    'attribution', (SELECT row_to_json(attribution_stats.*) FROM attribution_stats),
    'healthChecks', json_build_object(
      'hasTransactions', (SELECT total_transactions > 0 FROM txn_stats),
      'hasRecentData', (SELECT last_30_days > 0 FROM txn_stats),
      'hasRefcodes', (SELECT transactions_with_refcode > 0 FROM txn_stats),
      'hasSmsDetected', (SELECT EXISTS(SELECT 1 FROM sms_forms)),
      'hasMetaCampaigns', (SELECT meta_campaigns > 0 FROM meta_stats),
      'hasAttribution', (SELECT total_attributed > 0 FROM attribution_stats)
    ),
    'recommendations', (
      SELECT json_agg(rec) FROM (
        SELECT 'No transactions found - ensure ActBlue CSV has been uploaded' as rec
        WHERE (SELECT total_transactions FROM txn_stats) = 0
        UNION ALL
        SELECT 'No recent data - last transaction is over 30 days old' as rec
        WHERE (SELECT last_30_days FROM txn_stats) = 0 AND (SELECT total_transactions FROM txn_stats) > 0
        UNION ALL
        SELECT 'No refcodes detected - attribution will be limited' as rec
        WHERE (SELECT transactions_with_refcode FROM txn_stats) = 0 AND (SELECT total_transactions FROM txn_stats) > 0
        UNION ALL
        SELECT 'No SMS forms detected - verify contribution_form naming convention' as rec
        WHERE NOT EXISTS(SELECT 1 FROM sms_forms) AND (SELECT total_transactions FROM txn_stats) > 0
        UNION ALL
        SELECT 'No Meta campaigns synced - connect Meta integration' as rec
        WHERE (SELECT meta_campaigns FROM meta_stats) = 0
      ) recs
    ),
    'generatedAt', NOW()
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 7. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.detect_donation_channel TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_actblue_dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sms_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_client_data_health TO authenticated;