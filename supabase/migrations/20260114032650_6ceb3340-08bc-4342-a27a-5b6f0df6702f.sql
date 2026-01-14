-- Update donation_attribution view to use point-in-time attribution from refcode_mapping_history
-- Falls back to refcode_mappings for donations before history was tracked

DROP VIEW IF EXISTS donation_attribution;

CREATE OR REPLACE VIEW donation_attribution WITH (security_invoker = on) AS
SELECT
  t.id as transaction_id,
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
  -- Use point-in-time mapping from history if available, otherwise fall back to current mapping
  COALESCE(rmh.ad_id, rm.ad_id) as attributed_ad_id,
  COALESCE(rmh.creative_id, rm.creative_id) as attributed_creative_id,
  COALESCE(rmh.campaign_id, rm.campaign_id) as attributed_campaign_id,
  -- Track attribution method
  CASE
    WHEN rmh.ad_id IS NOT NULL THEN 'refcode_historical'
    WHEN rm.refcode IS NOT NULL THEN 'refcode_current'
    WHEN t.source_campaign IS NOT NULL THEN 'source_campaign'
    ELSE 'unattributed'
  END as attribution_method,
  -- Include timing info for debugging
  rmh.first_seen_at as mapping_first_seen,
  rmh.last_seen_at as mapping_last_seen
FROM actblue_transactions t
-- Join to historical mapping: find the ad that was active at the time of the donation
LEFT JOIN LATERAL (
  SELECT ad_id, creative_id, campaign_id, first_seen_at, last_seen_at
  FROM refcode_mapping_history h
  WHERE h.organization_id = t.organization_id
    AND h.refcode = t.refcode
    -- Find mapping where donation occurred during the ad's active period
    AND t.transaction_date >= h.first_seen_at
  ORDER BY h.first_seen_at DESC
  LIMIT 1
) rmh ON true
-- Fallback to current mapping for donations before history tracking started
LEFT JOIN refcode_mappings rm 
  ON t.organization_id = rm.organization_id 
  AND t.refcode = rm.refcode
  AND rmh.ad_id IS NULL  -- Only use current mapping if no historical match
WHERE can_access_organization_data(t.organization_id);

COMMENT ON VIEW donation_attribution IS 'Point-in-time donation attribution using historical refcode mappings with fallback to current mappings';