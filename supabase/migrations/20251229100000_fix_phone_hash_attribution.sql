-- Migration: Fix SMS phone_hash population and extend donation_attribution for SMS last-touch
--
-- ATTRIBUTION MODEL DOCUMENTATION:
-- This migration establishes a consistent "last-touch deterministic" attribution model:
-- 1. Refcode mapping (highest priority) - donation has refcode that maps to campaign/creative
-- 2. Click ID / FBCLID mapping - donation has click_id/fbclid that maps to ad
-- 3. SMS last-touch (7-day window) - donor's phone matches SMS recipient within 7 days before donation
-- 4. Unattributed - no deterministic signal found
--
-- Key fixes:
-- - Backfill phone_hash for existing sms_events
-- - Add trigger to auto-compute phone_hash on insert/update
-- - Extend donation_attribution view to include SMS last-touch attribution
-- - Add composite indexes for efficient phone_hash lookups

-- ============================================================================
-- 1. Backfill existing sms_events.phone_hash
-- ============================================================================
-- Compute phone_hash from recipient_phone: normalize to digits only, then SHA256
UPDATE public.sms_events
SET phone_hash = encode(
  digest(
    regexp_replace(recipient_phone, '\D', '', 'g')::bytea,
    'sha256'
  ),
  'hex'
)
WHERE phone_hash IS NULL
  AND recipient_phone IS NOT NULL
  AND length(regexp_replace(recipient_phone, '\D', '', 'g')) >= 10;

-- Log backfill count (for manual verification)
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.sms_events
  WHERE phone_hash IS NOT NULL;
  RAISE NOTICE 'Backfilled phone_hash for % sms_events', updated_count;
END $$;

-- ============================================================================
-- 2. Create trigger function to auto-compute phone_hash on insert/update
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_sms_phone_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_phone text;
BEGIN
  -- Normalize phone: remove all non-digit characters
  normalized_phone := regexp_replace(NEW.recipient_phone, '\D', '', 'g');

  -- Only compute hash if we have a valid phone (10+ digits)
  IF normalized_phone IS NOT NULL AND length(normalized_phone) >= 10 THEN
    NEW.phone_hash := encode(digest(normalized_phone::bytea, 'sha256'), 'hex');
  ELSE
    NEW.phone_hash := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.compute_sms_phone_hash() IS
  'Trigger function to auto-compute phone_hash from recipient_phone using SHA256';

-- Create trigger on sms_events (drop first if exists to allow re-running)
DROP TRIGGER IF EXISTS trg_sms_events_phone_hash ON public.sms_events;

CREATE TRIGGER trg_sms_events_phone_hash
  BEFORE INSERT OR UPDATE OF recipient_phone ON public.sms_events
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_sms_phone_hash();

-- ============================================================================
-- 3. Add composite indexes for efficient phone_hash lookups
-- ============================================================================
-- Index for joining SMS events to donations by org + phone_hash + time
CREATE INDEX IF NOT EXISTS idx_sms_events_org_phone_occurred
  ON public.sms_events(organization_id, phone_hash, occurred_at DESC)
  WHERE phone_hash IS NOT NULL;

-- Index for donation attribution by phone_hash
CREATE INDEX IF NOT EXISTS idx_actblue_phone_hash_date
  ON public.actblue_transactions(
    organization_id,
    encode(digest(regexp_replace(phone, '\D', '', 'g')::bytea, 'sha256'), 'hex'),
    transaction_date
  )
  WHERE phone IS NOT NULL;

-- ============================================================================
-- 4. Helper function to compute phone hash consistently
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_phone_hash(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN phone IS NOT NULL AND length(regexp_replace(phone, '\D', '', 'g')) >= 10
    THEN encode(digest(regexp_replace(phone, '\D', '', 'g')::bytea, 'sha256'), 'hex')
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.normalize_phone_hash(text) IS
  'Returns SHA256 hash of normalized phone number (digits only), or NULL if invalid';

-- ============================================================================
-- 5. Extended donation_attribution view with SMS last-touch attribution
-- ============================================================================
-- Drop and recreate to include SMS attribution path
DROP VIEW IF EXISTS public.donation_attribution;

CREATE VIEW public.donation_attribution AS
WITH sms_last_touch AS (
  -- Find the most recent SMS event within 7 days before each donation
  -- Using a lateral join for efficiency
  SELECT DISTINCT ON (t.id)
    t.id AS transaction_id,
    se.campaign_id AS sms_campaign_id,
    se.message_id AS sms_message_id,
    se.event_type AS sms_event_type,
    se.occurred_at AS sms_occurred_at
  FROM public.actblue_transactions t
  INNER JOIN public.sms_events se
    ON se.organization_id = t.organization_id
    AND se.phone_hash = public.normalize_phone_hash(t.phone)
    AND se.occurred_at >= t.transaction_date - interval '7 days'
    AND se.occurred_at < t.transaction_date
  WHERE t.phone IS NOT NULL
    AND se.phone_hash IS NOT NULL
    AND se.event_type IN ('sent', 'delivered', 'clicked')
  ORDER BY t.id, se.occurred_at DESC
)
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

  -- Deterministic platform priority: refcode mapping > click_id/fbclid > SMS last-touch > legacy source
  COALESCE(
    rm.platform,
    CASE WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'meta' END,
    CASE WHEN slt.sms_campaign_id IS NOT NULL THEN 'sms' END,
    t.source_campaign
  ) AS attributed_platform,

  -- Meta attribution fields
  rm.campaign_id AS attributed_campaign_id,
  rm.campaign_name AS attributed_campaign_name,
  rm.ad_id AS attributed_ad_id,
  rm.creative_id AS attributed_creative_id,
  rm.landing_page,
  rm.click_id AS mapped_click_id,
  rm.fbclid AS mapped_fbclid,
  t.click_id AS transaction_click_id,
  t.fbclid AS transaction_fbclid,

  -- SMS attribution fields (new)
  slt.sms_campaign_id,
  slt.sms_message_id,
  slt.sms_event_type,
  slt.sms_occurred_at,

  -- Attribution method hierarchy (for deterministic rate calculation)
  CASE
    WHEN rm.refcode IS NOT NULL THEN 'refcode'
    WHEN rm.click_id IS NOT NULL OR rm.fbclid IS NOT NULL THEN 'click_id'
    WHEN t.click_id IS NOT NULL OR t.fbclid IS NOT NULL THEN 'click_id'
    WHEN slt.sms_campaign_id IS NOT NULL THEN 'sms_last_touch'
    WHEN t.refcode IS NOT NULL THEN 'regex'
    ELSE 'unattributed'
  END AS attribution_method,

  -- Creative context from Meta
  mci.topic AS creative_topic,
  mci.tone AS creative_tone,
  mci.key_themes AS creative_themes,
  mci.emotional_appeal AS creative_emotional_appeal,

  -- Donor identity hashes (non-PII)
  CASE
    WHEN t.donor_email IS NOT NULL
    THEN encode(digest(lower(t.donor_email)::bytea, 'sha256'), 'hex')
    ELSE NULL
  END AS donor_id_hash,
  public.normalize_phone_hash(t.phone) AS donor_phone_hash

FROM public.actblue_transactions t

-- Join to refcode mappings for Meta attribution
LEFT JOIN public.refcode_mappings rm
  ON t.organization_id = rm.organization_id
  AND (
    (t.refcode IS NOT NULL AND t.refcode = rm.refcode)
    OR (t.click_id IS NOT NULL AND t.click_id = rm.click_id)
    OR (t.fbclid IS NOT NULL AND t.fbclid = rm.fbclid)
  )

-- Join to SMS last-touch CTE
LEFT JOIN sms_last_touch slt
  ON t.id = slt.transaction_id

-- Join to creative insights for topic/tone
LEFT JOIN public.meta_creative_insights mci
  ON rm.creative_id = mci.creative_id
  AND rm.organization_id = mci.organization_id

WHERE public.can_access_organization_data(t.organization_id);

COMMENT ON VIEW public.donation_attribution IS
  'Org-scoped donation attribution using last-touch deterministic model: '
  'refcode/click_id/fbclid -> meta; phone_hash -> SMS (7-day window); else unattributed. '
  'Includes creative context and non-PII donor hashes.';

-- ============================================================================
-- 6. Add RLS-safe helper view for SMS funnel donations
-- ============================================================================
CREATE OR REPLACE VIEW public.sms_attributed_donations AS
SELECT
  da.organization_id,
  da.transaction_id,
  da.amount,
  da.net_amount,
  da.transaction_date,
  da.sms_campaign_id,
  da.sms_message_id,
  da.sms_event_type,
  da.donor_phone_hash
FROM public.donation_attribution da
WHERE da.attribution_method = 'sms_last_touch'
  AND da.transaction_type = 'donation';

COMMENT ON VIEW public.sms_attributed_donations IS
  'Donations attributed to SMS via last-touch phone_hash matching (7-day window)';
