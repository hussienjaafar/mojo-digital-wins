-- Sprint 2: Recurring health scaffolding

-- 1) Add recurring_state and next_charge_date to ActBlue transactions
ALTER TABLE public.actblue_transactions
  ADD COLUMN IF NOT EXISTS recurring_state text,           -- active | cancelled | refunded | unknown
  ADD COLUMN IF NOT EXISTS next_charge_date date;

-- 2) Recreate secure view to expose recurring_state/next_charge_date
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

COMMENT ON VIEW public.actblue_transactions_secure IS 'Secure ActBlue view with conditional PII masking, donor hash, click IDs, and recurring state.';
