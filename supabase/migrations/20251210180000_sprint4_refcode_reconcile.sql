-- Sprint 4: deterministic attribution uplift (reconcile refcodes to creatives)

-- Ensure refcode_mappings has timestamps and indexes to support reconcile job
ALTER TABLE refcode_mappings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_refcode_mappings_refcode ON refcode_mappings(organization_id, refcode);
CREATE INDEX IF NOT EXISTS idx_refcode_mappings_platform ON refcode_mappings(organization_id, platform);

COMMENT ON TABLE refcode_mappings IS 'Deterministic mapping of refcode -> platform/campaign/ad/creative for attribution.';
