-- Sprint 3: donor journeys + SMS funnel scaffolding

-- 1) Update secure view to include phone_hash for matching SMS events to donations
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
  recurring_state,
  next_charge_date,
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
  click_id,
  fbclid,
  created_at,
  CASE 
    WHEN donor_email IS NOT NULL THEN encode(digest(lower(donor_email)::bytea, 'sha256'), 'hex') 
    ELSE NULL 
  END AS donor_id_hash,
  -- Phone hash for joining SMS events (non-PII)
  CASE 
    WHEN phone IS NOT NULL THEN encode(digest(regexp_replace(phone, '\\D', '', 'g')::bytea, 'sha256'), 'hex')
    ELSE NULL
  END AS phone_hash,
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

COMMENT ON VIEW public.actblue_transactions_secure IS 'Secure ActBlue view with conditional PII masking, donor hash, phone hash, click IDs, and recurring state.';

-- 2) Donor journeys view (non-PII: uses hashes)
DROP VIEW IF EXISTS donor_journeys;
CREATE VIEW donor_journeys AS
SELECT
  t.organization_id,
  COALESCE(t.donor_id_hash, t.phone_hash) AS donor_key,
  'donation' AS event_type,
  t.transaction_date AS occurred_at,
  t.amount,
  t.net_amount,
  t.refcode,
  t.source_campaign AS source,
  t.transaction_type,
  t.recurring_state,
  t.next_charge_date,
  jsonb_build_object(
    'payment_method', t.payment_method,
    'recurring', t.is_recurring,
    'transaction_id', t.transaction_id
  ) AS metadata
FROM actblue_transactions t
WHERE can_access_organization_data(t.organization_id)
  AND (t.donor_id_hash IS NOT NULL OR t.phone_hash IS NOT NULL)

UNION ALL

SELECT
  a.organization_id,
  encode(digest(lower(a.donor_email)::bytea, 'sha256'), 'hex') AS donor_key,
  'touchpoint' AS event_type,
  a.occurred_at,
  NULL AS amount,
  NULL AS net_amount,
  a.refcode,
  a.touchpoint_type AS source,
  NULL AS transaction_type,
  NULL AS recurring_state,
  NULL AS next_charge_date,
  a.metadata
FROM attribution_touchpoints a
WHERE can_access_organization_data(a.organization_id)
  AND a.donor_email IS NOT NULL

UNION ALL

SELECT
  s.organization_id,
  s.phone_hash AS donor_key,
  s.event_type,
  s.occurred_at,
  NULL AS amount,
  NULL AS net_amount,
  NULL AS refcode,
  'sms' AS source,
  NULL AS transaction_type,
  NULL AS recurring_state,
  NULL AS next_charge_date,
  s.metadata
FROM sms_events s
WHERE can_access_organization_data(s.organization_id)
  AND s.phone_hash IS NOT NULL;

COMMENT ON VIEW public.donor_journeys IS 'Non-PII donor journey events (donations, touchpoints, SMS) keyed by donor hash/phone hash.';
