-- Update donation_attribution view to include contribution_form for SMS detection
-- This enables proper SMS attribution via contribution_form patterns (e.g., 'moliticosms')

DROP VIEW IF EXISTS donation_attribution;

CREATE VIEW donation_attribution AS
WITH ad_date_ranges AS (
  SELECT 
    rmh.organization_id,
    rmh.refcode,
    rmh.ad_id,
    rmh.creative_id,
    rmh.campaign_id,
    COALESCE(min(madm.date), rmh.first_seen_at::date) AS effective_start_date,
    COALESCE(max(madm.date), rmh.last_seen_at::date) AS effective_end_date,
    rmh.is_active
  FROM refcode_mapping_history rmh
  LEFT JOIN meta_ad_metrics_daily madm ON rmh.ad_id = madm.ad_id
  GROUP BY rmh.organization_id, rmh.refcode, rmh.ad_id, rmh.creative_id, rmh.campaign_id, rmh.first_seen_at, rmh.last_seen_at, rmh.is_active
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
  t.contribution_form,  -- NEW: Added for SMS detection
  COALESCE(matched_history.ad_id, rm.ad_id) AS attributed_ad_id,
  COALESCE(matched_history.creative_id, rm.creative_id) AS attributed_creative_id,
  COALESCE(matched_history.campaign_id, rm.campaign_id) AS attributed_campaign_id,
  CASE
    -- Tier 1: Deterministic Meta attribution via refcode history
    WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'exact_range' THEN 'refcode_exact_date'
    WHEN matched_history.ad_id IS NOT NULL AND matched_history.match_type = 'active_fallback' THEN 'refcode_active_ad'
    WHEN matched_history.ad_id IS NOT NULL THEN 'refcode_historical'
    WHEN rm.refcode IS NOT NULL AND rm.platform = 'meta' THEN 'refcode_meta'
    -- NEW: SMS attribution via refcode_mappings platform
    WHEN rm.refcode IS NOT NULL AND rm.platform = 'sms' THEN 'sms_refcode'
    -- NEW: SMS attribution via contribution_form pattern (Tier 3)
    WHEN t.contribution_form ILIKE '%sms%' THEN 'contribution_form_sms'
    -- Existing fallbacks
    WHEN rm.refcode IS NOT NULL THEN 'refcode_current'
    WHEN t.source_campaign IS NOT NULL THEN 'source_campaign'
    ELSE 'unattributed'
  END AS attribution_method,
  -- NEW: Add attributed_platform for easier channel detection
  CASE
    WHEN matched_history.ad_id IS NOT NULL THEN 'meta'
    WHEN rm.platform = 'meta' THEN 'meta'
    WHEN rm.platform = 'sms' THEN 'sms'
    WHEN t.contribution_form ILIKE '%sms%' THEN 'sms'
    WHEN t.refcode ILIKE 'txt%' OR t.refcode ILIKE 'sms%' THEN 'sms'
    WHEN t.refcode ILIKE 'em%' OR t.refcode ILIKE 'email%' THEN 'email'
    ELSE NULL
  END AS attributed_platform,
  matched_history.effective_start_date AS mapping_first_seen,
  matched_history.effective_end_date AS mapping_last_seen,
  CASE
    WHEN matched_history.match_type = 'exact_range' THEN 1.0
    WHEN matched_history.match_type = 'active_fallback' THEN 0.8
    WHEN rm.platform = 'sms' THEN 0.9  -- SMS refcode mapping is high confidence
    WHEN t.contribution_form ILIKE '%sms%' THEN 0.7  -- Contribution form pattern is medium
    WHEN rm.refcode IS NOT NULL THEN 0.6
    ELSE 0.0
  END AS attribution_confidence
FROM actblue_transactions t
LEFT JOIN LATERAL (
  SELECT 
    adr.ad_id,
    adr.creative_id,
    adr.campaign_id,
    adr.effective_start_date,
    adr.effective_end_date,
    CASE
      WHEN t.transaction_date::date >= adr.effective_start_date 
       AND t.transaction_date::date <= adr.effective_end_date THEN 'exact_range'
      WHEN adr.is_active = true THEN 'active_fallback'
      ELSE 'historical'
    END AS match_type
  FROM ad_date_ranges adr
  WHERE adr.organization_id = t.organization_id 
    AND adr.refcode = t.refcode 
    AND (
      (t.transaction_date::date >= adr.effective_start_date AND t.transaction_date::date <= adr.effective_end_date)
      OR (adr.is_active = true AND NOT EXISTS (
        SELECT 1 FROM ad_date_ranges adr2
        WHERE adr2.organization_id = t.organization_id 
          AND adr2.refcode = t.refcode
          AND t.transaction_date::date >= adr2.effective_start_date 
          AND t.transaction_date::date <= adr2.effective_end_date
      ))
    )
  ORDER BY 
    CASE WHEN t.transaction_date::date >= adr.effective_start_date AND t.transaction_date::date <= adr.effective_end_date THEN 0 ELSE 1 END,
    adr.effective_start_date DESC
  LIMIT 1
) matched_history ON true
LEFT JOIN refcode_mappings rm ON t.organization_id = rm.organization_id AND t.refcode = rm.refcode AND matched_history.ad_id IS NULL
WHERE can_access_organization_data(t.organization_id);