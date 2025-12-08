-- Codex patch: tighten PII handling, dedup accuracy, and attribution view access

-- 1) Recreate secure ActBlue view with conditional masking and stable donor hash
DROP VIEW IF EXISTS actblue_transactions_secure;
CREATE VIEW actblue_transactions_secure AS
SELECT 
  id,
  organization_id,
  transaction_id,
  transaction_date,
  transaction_type,
  amount,
  net_amount,
  fee,
  refcode,
  refcode2,
  refcode_custom,
  source_campaign,
  is_recurring,
  recurring_period,
  recurring_duration,
  recurring_upsell_shown,
  recurring_upsell_succeeded,
  payment_method,
  card_type,
  smart_boost_amount,
  double_down,
  is_express,
  is_mobile,
  ab_test_name,
  ab_test_variation,
  contribution_form,
  entity_id,
  committee_name,
  created_at,
  -- Stable, non-PII identifier for deduplication/analytics
  CASE 
    WHEN donor_email IS NOT NULL THEN encode(digest(lower(donor_email)::bytea, 'sha256'), 'hex') 
    ELSE NULL 
  END AS donor_id_hash,
  -- Conditional PII masking
  CASE WHEN has_pii_access(organization_id) THEN donor_name ELSE mask_name(donor_name) END AS donor_name,
  CASE WHEN has_pii_access(organization_id) THEN first_name ELSE mask_name(first_name) END AS first_name,
  CASE WHEN has_pii_access(organization_id) THEN last_name ELSE mask_name(last_name) END AS last_name,
  CASE WHEN has_pii_access(organization_id) THEN donor_email ELSE mask_email(donor_email) END AS donor_email,
  CASE WHEN has_pii_access(organization_id) THEN phone ELSE mask_phone(phone) END AS phone,
  CASE WHEN has_pii_access(organization_id) THEN addr1 ELSE mask_address(addr1) END AS addr1,
  city,
  state,
  CASE WHEN has_pii_access(organization_id) THEN zip ELSE LEFT(zip, 3) || '**' END AS zip,
  country
FROM actblue_transactions
WHERE can_access_organization_data(organization_id);

COMMENT ON VIEW public.actblue_transactions_secure IS 'Secure view with conditional PII masking and a stable donor hash for deduplication. Access limited via can_access_organization_data() and has_pii_access().';

-- 2) Restrict donation_attribution view to org the caller can access
DROP VIEW IF EXISTS donation_attribution;
CREATE VIEW donation_attribution AS
SELECT 
  t.id as transaction_id,
  t.organization_id,
  t.amount,
  t.net_amount,
  t.fee,
  t.transaction_date,
  t.transaction_type,
  t.refcode,
  t.refcode2,
  t.refcode_custom,
  t.is_recurring,
  t.recurring_period,
  t.payment_method,
  t.card_type,
  COALESCE(rm.platform, t.source_campaign) as attributed_platform,
  rm.campaign_id as attributed_campaign_id,
  rm.campaign_name as attributed_campaign_name,
  rm.ad_id as attributed_ad_id,
  rm.creative_id as attributed_creative_id,
  rm.landing_page,
  mci.topic as creative_topic,
  mci.tone as creative_tone,
  mci.key_themes as creative_themes,
  mci.emotional_appeal as creative_emotional_appeal
FROM actblue_transactions t
LEFT JOIN refcode_mappings rm 
  ON t.organization_id = rm.organization_id 
  AND t.refcode = rm.refcode
LEFT JOIN meta_creative_insights mci 
  ON rm.creative_id = mci.creative_id
  AND rm.organization_id = mci.organization_id
WHERE can_access_organization_data(t.organization_id);

COMMENT ON VIEW public.donation_attribution IS 'Org-scoped donation attribution with deterministic refcode mappings and creative context. Enforced by can_access_organization_data().';
