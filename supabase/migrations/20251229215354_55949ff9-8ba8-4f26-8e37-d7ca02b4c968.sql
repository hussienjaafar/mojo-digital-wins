
-- Fix donation_attribution view to include attribution_method column
-- This column is expected by useClientDashboardMetricsQuery.ts and useKpiDrilldownQuery.ts

DROP VIEW IF EXISTS donation_attribution;

CREATE VIEW donation_attribution AS
SELECT 
  t.id as transaction_id, 
  t.organization_id, 
  t.transaction_date, 
  t.amount, 
  t.net_amount, 
  t.fee,
  t.transaction_type, 
  t.refcode, 
  t.source_campaign, 
  t.is_recurring,
  encode(sha256(COALESCE(t.donor_email, t.transaction_id)::bytea), 'hex') as donor_id_hash,
  CASE WHEN has_pii_access(t.organization_id) THEN t.donor_email ELSE mask_email(t.donor_email) END as donor_email,
  rm.platform as attributed_platform,
  rm.campaign_id as attributed_campaign_id,
  rm.ad_id as attributed_ad_id,
  rm.creative_id as attributed_creative_id,
  mci.creative_type,
  mci.topic as creative_topic,
  mci.tone as creative_tone,
  -- Add the attribution_method column that the code expects
  CASE
    WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'click_id'
    WHEN rm.refcode IS NOT NULL THEN 'refcode'
    WHEN t.source_campaign IS NOT NULL THEN 'source_campaign'
    ELSE 'unattributed'
  END as attribution_method
FROM actblue_transactions t
LEFT JOIN refcode_mappings rm ON t.organization_id = rm.organization_id AND t.refcode = rm.refcode
LEFT JOIN meta_creative_insights mci ON rm.creative_id = mci.creative_id AND rm.organization_id = mci.organization_id
WHERE can_access_organization_data(t.organization_id);

COMMENT ON VIEW donation_attribution IS 'Secure donation attribution view with organization-scoped access, PII masking, and attribution method classification';
