-- Migration: Add donor_first_donation view for lifetime-based new/returning classification
--
-- PURPOSE:
-- This view provides the first donation date for each donor (identified by donor_key).
-- Used to determine if a donor is "new" (first donation within date range) or "returning"
-- (first donation predates the date range).
--
-- DONOR KEY:
-- Uses COALESCE(donor_id_hash, donor_phone_hash) to create a unified donor identity.
-- - donor_id_hash: SHA256 of email (primary identifier)
-- - donor_phone_hash: SHA256 of phone (fallback when email unavailable)
--
-- SECURITY:
-- Enforces RLS via can_access_organization_data function.

-- ============================================================================
-- 1. Create materialized index for donor first donation lookups
-- ============================================================================
-- Index on actblue_transactions for finding first donation by donor
CREATE INDEX IF NOT EXISTS idx_actblue_donor_first_donation
  ON public.actblue_transactions(
    organization_id,
    COALESCE(
      encode(digest(lower(donor_email)::bytea, 'sha256'), 'hex'),
      encode(digest(regexp_replace(phone, '\D', '', 'g')::bytea, 'sha256'), 'hex')
    ),
    transaction_date ASC
  )
  WHERE transaction_type = 'donation';

-- ============================================================================
-- 2. Create donor_first_donation view
-- ============================================================================
CREATE OR REPLACE VIEW public.donor_first_donation AS
SELECT
  t.organization_id,
  COALESCE(
    encode(digest(lower(t.donor_email)::bytea, 'sha256'), 'hex'),
    public.normalize_phone_hash(t.phone)
  ) AS donor_key,
  MIN(t.transaction_date) AS first_donation_at
FROM public.actblue_transactions t
WHERE t.transaction_type = 'donation'
  AND (t.donor_email IS NOT NULL OR t.phone IS NOT NULL)
  AND public.can_access_organization_data(t.organization_id)
GROUP BY
  t.organization_id,
  COALESCE(
    encode(digest(lower(t.donor_email)::bytea, 'sha256'), 'hex'),
    public.normalize_phone_hash(t.phone)
  );

COMMENT ON VIEW public.donor_first_donation IS
  'Provides the first donation date for each donor (by donor_key = email hash or phone hash). '
  'Used for lifetime-based new/returning donor classification. '
  'RLS enforced via can_access_organization_data.';

-- ============================================================================
-- 3. Add composite index on view's underlying query for fast lookups
-- ============================================================================
-- This index supports the GROUP BY and MIN operations
CREATE INDEX IF NOT EXISTS idx_actblue_org_donor_date_asc
  ON public.actblue_transactions(
    organization_id,
    donor_email,
    phone,
    transaction_date ASC
  )
  WHERE transaction_type = 'donation';
