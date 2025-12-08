-- Sprint 4: deterministic attribution via click_id/fbclid

-- Ensure refcode_mappings can store click IDs
ALTER TABLE refcode_mappings
  ADD COLUMN IF NOT EXISTS click_id text,
  ADD COLUMN IF NOT EXISTS fbclid text;

-- View to surface donations missing refcode but with click IDs (for reconciliation)
DROP VIEW IF EXISTS donation_clickid_candidates;
CREATE VIEW donation_clickid_candidates AS
SELECT
  organization_id,
  transaction_id,
  transaction_date,
  click_id,
  fbclid
FROM actblue_transactions
WHERE refcode IS NULL
  AND (click_id IS NOT NULL OR fbclid IS NOT NULL)
  AND can_access_organization_data(organization_id);

COMMENT ON VIEW public.donation_clickid_candidates IS 'Donations lacking refcode but with click_id/fbclid for deterministic mapping.';
