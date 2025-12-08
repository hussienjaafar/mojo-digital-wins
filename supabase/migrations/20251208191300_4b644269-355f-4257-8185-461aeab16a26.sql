-- Phase 1: Add net_amount computed column to actblue_transactions
ALTER TABLE actblue_transactions 
ADD COLUMN IF NOT EXISTS net_amount numeric 
GENERATED ALWAYS AS (COALESCE(amount, 0) - COALESCE(fee, 0)) STORED;

-- Phase 2: Create refcode_mappings table for deterministic attribution
CREATE TABLE IF NOT EXISTS refcode_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES client_organizations(id) ON DELETE CASCADE,
  refcode text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  platform text, -- 'meta', 'sms', 'email', 'google', 'organic'
  campaign_id text,
  campaign_name text,
  ad_id text,
  ad_name text,
  creative_id text,
  creative_name text,
  landing_page text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, refcode)
);

-- Enable RLS on refcode_mappings
ALTER TABLE refcode_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for refcode_mappings
CREATE POLICY "Users can view their org refcode mappings"
  ON refcode_mappings FOR SELECT
  USING (public.user_belongs_to_organization(organization_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage refcode mappings"
  ON refcode_mappings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access to refcode_mappings"
  ON refcode_mappings FOR ALL
  USING (auth.uid() IS NULL AND current_setting('role') = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_refcode ON refcode_mappings(organization_id, refcode);
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_platform ON refcode_mappings(organization_id, platform);

-- Phase 3: Create donation_attribution view
CREATE OR REPLACE VIEW donation_attribution AS
SELECT 
  t.id as transaction_id,
  t.organization_id,
  t.amount,
  t.net_amount,
  t.fee,
  t.transaction_date,
  t.transaction_type,
  t.refcode,
  t.is_recurring,
  t.recurring_period,
  t.payment_method,
  t.card_type,
  COALESCE(rm.platform, t.source_campaign) as attributed_platform,
  rm.campaign_id as attributed_campaign_id,
  rm.campaign_name as attributed_campaign_name,
  rm.ad_id as attributed_ad_id,
  rm.creative_id as attributed_creative_id,
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
  AND rm.organization_id = mci.organization_id;

-- Phase 4: Create donor_segments view
CREATE OR REPLACE VIEW donor_segments AS
SELECT 
  dd.id,
  dd.organization_id,
  dd.donor_email,
  dd.first_name,
  dd.last_name,
  dd.city,
  dd.state,
  dd.zip,
  dd.total_donated,
  dd.donation_count,
  dd.first_donation_date,
  dd.last_donation_date,
  dd.is_recurring,
  CASE 
    WHEN dd.total_donated >= 1000 THEN 'major'
    WHEN dd.donation_count >= 5 THEN 'repeat'
    WHEN dd.last_donation_date > NOW() - INTERVAL '90 days' THEN 'active'
    WHEN dd.last_donation_date > NOW() - INTERVAL '180 days' THEN 'lapsing'
    ELSE 'lapsed'
  END as donor_tier,
  CASE
    WHEN dd.donation_count = 1 THEN 'new'
    WHEN dd.donation_count BETWEEN 2 AND 4 THEN 'developing'
    WHEN dd.donation_count >= 5 THEN 'loyal'
    ELSE 'unknown'
  END as donor_frequency_segment,
  DATE_PART('day', NOW() - dd.last_donation_date) as days_since_donation,
  CASE
    WHEN dd.total_donated >= 1000 THEN 5
    WHEN dd.total_donated >= 500 THEN 4
    WHEN dd.total_donated >= 100 THEN 3
    WHEN dd.total_donated >= 25 THEN 2
    ELSE 1
  END as monetary_score,
  CASE
    WHEN dd.donation_count >= 10 THEN 5
    WHEN dd.donation_count >= 5 THEN 4
    WHEN dd.donation_count >= 3 THEN 3
    WHEN dd.donation_count >= 2 THEN 2
    ELSE 1
  END as frequency_score,
  CASE
    WHEN dd.last_donation_date > NOW() - INTERVAL '30 days' THEN 5
    WHEN dd.last_donation_date > NOW() - INTERVAL '60 days' THEN 4
    WHEN dd.last_donation_date > NOW() - INTERVAL '90 days' THEN 3
    WHEN dd.last_donation_date > NOW() - INTERVAL '180 days' THEN 2
    ELSE 1
  END as recency_score
FROM donor_demographics dd;

-- Phase 5: Update secure view to expose more fields
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
  -- Masked PII fields
  public.mask_name(donor_name) as donor_name,
  public.mask_name(first_name) as first_name,
  public.mask_name(last_name) as last_name,
  public.mask_email(donor_email) as donor_email,
  public.mask_phone(phone) as phone,
  public.mask_address(addr1) as addr1,
  city,
  state,
  LEFT(zip, 3) || '**' as zip,
  country
FROM actblue_transactions;