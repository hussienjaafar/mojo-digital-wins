-- Fix 1: Update actblue_transactions_secure with conditional PII masking and stable donor_id_hash
DROP VIEW IF EXISTS actblue_transactions_secure;
CREATE VIEW actblue_transactions_secure AS
SELECT 
  id, organization_id, transaction_id,
  encode(sha256(COALESCE(donor_email, transaction_id)::bytea), 'hex') as donor_id_hash,
  CASE WHEN has_pii_access(organization_id) THEN donor_email ELSE mask_email(donor_email) END as donor_email,
  CASE WHEN has_pii_access(organization_id) THEN donor_name ELSE mask_name(donor_name) END as donor_name,
  CASE WHEN has_pii_access(organization_id) THEN first_name ELSE mask_name(first_name) END as first_name,
  CASE WHEN has_pii_access(organization_id) THEN last_name ELSE mask_name(last_name) END as last_name,
  CASE WHEN has_pii_access(organization_id) THEN phone ELSE mask_phone(phone) END as phone,
  CASE WHEN has_pii_access(organization_id) THEN addr1 ELSE mask_address(addr1) END as addr1,
  city, state,
  CASE WHEN has_pii_access(organization_id) THEN zip ELSE CONCAT(LEFT(zip, 3), '**') END as zip,
  country, employer, occupation, amount, net_amount, fee, payment_method, card_type,
  smart_boost_amount, double_down, recurring_upsell_shown, recurring_upsell_succeeded,
  order_number, contribution_form, refcode, refcode2, refcode_custom, source_campaign,
  ab_test_name, ab_test_variation, is_mobile, is_express, text_message_option,
  lineitem_id, entity_id, committee_name, fec_id, recurring_period, recurring_duration,
  is_recurring, custom_fields, transaction_type, transaction_date, created_at
FROM actblue_transactions
WHERE can_access_organization_data(organization_id);

COMMENT ON VIEW actblue_transactions_secure IS 'Secure ActBlue transactions view with conditional PII masking and stable donor_id_hash';

-- Fix 4: Update donation_attribution view with access control (correct column names: topic, tone)
DROP VIEW IF EXISTS donation_attribution;
CREATE VIEW donation_attribution AS
SELECT 
  t.id as transaction_id, t.organization_id, t.transaction_date, t.amount, t.net_amount, t.fee,
  t.transaction_type, t.refcode, t.source_campaign, t.is_recurring,
  encode(sha256(COALESCE(t.donor_email, t.transaction_id)::bytea), 'hex') as donor_id_hash,
  CASE WHEN has_pii_access(t.organization_id) THEN t.donor_email ELSE mask_email(t.donor_email) END as donor_email,
  rm.platform as attributed_platform,
  rm.campaign_id as attributed_campaign_id,
  rm.ad_id as attributed_ad_id,
  rm.creative_id as attributed_creative_id,
  mci.creative_type,
  mci.topic as creative_topic,
  mci.tone as creative_tone
FROM actblue_transactions t
LEFT JOIN refcode_mappings rm ON t.organization_id = rm.organization_id AND t.refcode = rm.refcode
LEFT JOIN meta_creative_insights mci ON rm.creative_id = mci.creative_id AND rm.organization_id = mci.organization_id
WHERE can_access_organization_data(t.organization_id);

COMMENT ON VIEW donation_attribution IS 'Secure donation attribution view with organization-scoped access and PII masking';

-- Fix 4b: Update donor_segments view with proper access control
DROP VIEW IF EXISTS donor_segments;
CREATE VIEW donor_segments AS
SELECT 
    dd.id, dd.organization_id,
    encode(sha256(COALESCE(dd.donor_email, dd.id::text)::bytea), 'hex') as donor_id_hash,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.donor_email ELSE mask_email(dd.donor_email) END AS donor_email,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.first_name ELSE mask_name(dd.first_name) END AS first_name,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.last_name ELSE mask_name(dd.last_name) END AS last_name,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.city ELSE '***' END AS city,
    dd.state,
    CASE WHEN has_pii_access(dd.organization_id) THEN dd.zip ELSE CONCAT(LEFT(dd.zip, 3), '**') END AS zip,
    dd.total_donated, dd.donation_count, dd.first_donation_date, dd.last_donation_date, dd.is_recurring,
    CASE WHEN (dd.total_donated >= 1000) THEN 'major' WHEN (dd.donation_count >= 5) THEN 'repeat' WHEN (dd.last_donation_date > (now() - '90 days'::interval)) THEN 'active' WHEN (dd.last_donation_date > (now() - '180 days'::interval)) THEN 'lapsing' ELSE 'lapsed' END AS donor_tier,
    CASE WHEN (dd.donation_count = 1) THEN 'new' WHEN (dd.donation_count >= 2 AND dd.donation_count <= 4) THEN 'developing' WHEN (dd.donation_count >= 5) THEN 'loyal' ELSE 'unknown' END AS donor_frequency_segment,
    date_part('day', (now() - dd.last_donation_date)) AS days_since_donation,
    CASE WHEN (dd.total_donated >= 1000) THEN 5 WHEN (dd.total_donated >= 500) THEN 4 WHEN (dd.total_donated >= 100) THEN 3 WHEN (dd.total_donated >= 25) THEN 2 ELSE 1 END AS monetary_score,
    CASE WHEN (dd.donation_count >= 10) THEN 5 WHEN (dd.donation_count >= 5) THEN 4 WHEN (dd.donation_count >= 3) THEN 3 WHEN (dd.donation_count >= 2) THEN 2 ELSE 1 END AS frequency_score,
    CASE WHEN (dd.last_donation_date > (now() - '30 days'::interval)) THEN 5 WHEN (dd.last_donation_date > (now() - '60 days'::interval)) THEN 4 WHEN (dd.last_donation_date > (now() - '90 days'::interval)) THEN 3 WHEN (dd.last_donation_date > (now() - '180 days'::interval)) THEN 2 ELSE 1 END AS recency_score
FROM donor_demographics dd
WHERE can_access_organization_data(dd.organization_id);

COMMENT ON VIEW donor_segments IS 'Secure donor segments view with organization-scoped access and PII masking';