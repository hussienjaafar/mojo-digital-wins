-- Create diagnostic view to identify ads sharing refcodes with activity date ranges
CREATE OR REPLACE VIEW ad_refcode_overlap AS
WITH ad_activity AS (
  -- Get actual activity date ranges from daily metrics
  SELECT 
    madm.ad_id,
    madm.organization_id,
    MAX(madm.ad_name) as ad_name,
    MIN(madm.date) as first_active_date,
    MAX(madm.date) as last_active_date,
    SUM(madm.spend) as total_spend,
    COUNT(DISTINCT madm.date) as active_days
  FROM meta_ad_metrics_daily madm
  GROUP BY madm.ad_id, madm.organization_id
),
refcode_ads AS (
  -- Get all ad-refcode mappings with activity data
  SELECT 
    rmh.organization_id,
    rmh.refcode,
    rmh.ad_id,
    rmh.campaign_id,
    aa.ad_name,
    aa.first_active_date,
    aa.last_active_date,
    aa.total_spend,
    aa.active_days,
    rmh.is_active,
    rmh.first_seen_at as history_first_seen,
    rmh.last_seen_at as history_last_seen
  FROM refcode_mapping_history rmh
  LEFT JOIN ad_activity aa ON rmh.ad_id = aa.ad_id AND rmh.organization_id = aa.organization_id
)
SELECT 
  ra.organization_id,
  ra.refcode,
  COUNT(DISTINCT ra.ad_id) as ad_count,
  BOOL_OR(
    EXISTS (
      SELECT 1 FROM refcode_ads ra2 
      WHERE ra2.refcode = ra.refcode 
        AND ra2.organization_id = ra.organization_id
        AND ra2.ad_id != ra.ad_id
        AND ra2.first_active_date IS NOT NULL
        AND ra.first_active_date IS NOT NULL
        AND ra2.first_active_date <= ra.last_active_date
        AND ra2.last_active_date >= ra.first_active_date
    )
  ) as has_date_overlap,
  jsonb_agg(
    jsonb_build_object(
      'ad_id', ra.ad_id,
      'ad_name', ra.ad_name,
      'campaign_id', ra.campaign_id,
      'first_active_date', ra.first_active_date,
      'last_active_date', ra.last_active_date,
      'total_spend', ra.total_spend,
      'active_days', ra.active_days,
      'is_active', ra.is_active
    ) ORDER BY ra.first_active_date NULLS LAST
  ) as ads
FROM refcode_ads ra
GROUP BY ra.organization_id, ra.refcode
HAVING COUNT(DISTINCT ra.ad_id) > 1;

-- Grant access
GRANT SELECT ON ad_refcode_overlap TO authenticated;

-- Update donation_attribution view to use actual metrics date ranges for proper point-in-time attribution
DROP VIEW IF EXISTS donation_attribution;

CREATE VIEW donation_attribution 
WITH (security_invoker=on) AS
WITH ad_date_ranges AS (
  -- Get the actual date ranges when each ad was active from metrics
  SELECT 
    rmh.organization_id,
    rmh.refcode,
    rmh.ad_id,
    rmh.creative_id,
    rmh.campaign_id,
    -- Use metrics dates if available, otherwise fall back to history dates
    COALESCE(MIN(madm.date), rmh.first_seen_at::date) as effective_start_date,
    COALESCE(MAX(madm.date), rmh.last_seen_at::date) as effective_end_date,
    rmh.is_active
  FROM refcode_mapping_history rmh
  LEFT JOIN meta_ad_metrics_daily madm ON rmh.ad_id = madm.ad_id
  GROUP BY rmh.organization_id, rmh.refcode, rmh.ad_id, rmh.creative_id, rmh.campaign_id, 
           rmh.first_seen_at, rmh.last_seen_at, rmh.is_active
)
SELECT 
  t.id AS transaction_id,
  t.organization_id,
  t.transaction_date,
  t.amount,
  t.net_amount,
  t.refcode,
  t.donor_email,
  t.donor_name,
  t.transaction_type,
  t.is_recurring,
  t.source_campaign,
  -- Attributed ad info
  COALESCE(matched_history.ad_id, rm.ad_id) AS attributed_ad_id,
  COALESCE(matched_history.creative_id, rm.creative_id) AS attributed_creative_id,
  COALESCE(matched_history.campaign_id, rm.campaign_id) AS attributed_campaign_id,
  -- Attribution method with more detail
  CASE
    WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'exact_range' THEN 'refcode_exact_date'
    WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'active_fallback' THEN 'refcode_active_ad'
    WHEN matched_history.ad_id IS NOT NULL THEN 'refcode_historical'
    WHEN rm.refcode IS NOT NULL THEN 'refcode_current'
    WHEN t.source_campaign IS NOT NULL THEN 'source_campaign'
    ELSE 'unattributed'
  END AS attribution_method,
  -- Date range info for debugging
  matched_history.effective_start_date AS mapping_first_seen,
  matched_history.effective_end_date AS mapping_last_seen,
  -- Confidence indicator
  CASE
    WHEN matched_history.match_type = 'exact_range' THEN 1.0
    WHEN matched_history.match_type = 'active_fallback' THEN 0.8
    WHEN rm.refcode IS NOT NULL THEN 0.6
    ELSE 0.0
  END AS attribution_confidence
FROM actblue_transactions t
-- Try to find the ad that was active on the transaction date
LEFT JOIN LATERAL (
  SELECT 
    adr.ad_id,
    adr.creative_id,
    adr.campaign_id,
    adr.effective_start_date,
    adr.effective_end_date,
    CASE 
      WHEN t.transaction_date::date BETWEEN adr.effective_start_date AND adr.effective_end_date THEN 'exact_range'
      WHEN adr.is_active = true THEN 'active_fallback'
      ELSE 'historical'
    END as match_type
  FROM ad_date_ranges adr
  WHERE adr.organization_id = t.organization_id 
    AND adr.refcode = t.refcode
    AND (
      -- Exact date match: transaction falls within ad's active period
      (t.transaction_date::date BETWEEN adr.effective_start_date AND adr.effective_end_date)
      OR
      -- Fallback: if no exact match, use the active ad
      (adr.is_active = true AND NOT EXISTS (
        SELECT 1 FROM ad_date_ranges adr2 
        WHERE adr2.organization_id = t.organization_id 
          AND adr2.refcode = t.refcode
          AND t.transaction_date::date BETWEEN adr2.effective_start_date AND adr2.effective_end_date
      ))
    )
  ORDER BY 
    CASE WHEN t.transaction_date::date BETWEEN adr.effective_start_date AND adr.effective_end_date THEN 0 ELSE 1 END,
    adr.effective_start_date DESC
  LIMIT 1
) matched_history ON true
-- Fallback to current refcode mapping if no history match
LEFT JOIN refcode_mappings rm ON t.organization_id = rm.organization_id 
  AND t.refcode = rm.refcode 
  AND matched_history.ad_id IS NULL
WHERE can_access_organization_data(t.organization_id);