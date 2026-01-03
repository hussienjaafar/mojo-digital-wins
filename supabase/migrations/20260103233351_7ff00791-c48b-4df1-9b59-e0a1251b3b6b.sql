-- ================================================================================
-- ATTRIBUTION MATCHER AUDIT LOG
-- ================================================================================
-- Tracks every run of the attribution matcher for auditing and debugging.
-- This enables verification that:
-- 1. Matches are idempotent (no duplicates created)
-- 2. Deterministic counts are stable
-- 3. No drift in attribution over time
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.attribution_matcher_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES client_organizations(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dry_run boolean DEFAULT true,
  
  -- Match counts by type
  matches_deterministic int DEFAULT 0,
  matches_heuristic_partial int DEFAULT 0,
  matches_heuristic_pattern int DEFAULT 0,
  matches_heuristic_fuzzy int DEFAULT 0,
  total_matches int DEFAULT 0,
  
  -- Skipped counts
  skipped_existing int DEFAULT 0,
  skipped_deterministic_protected int DEFAULT 0,
  unmatched_count int DEFAULT 0,
  
  -- Revenue metrics
  matched_revenue numeric(12,2) DEFAULT 0,
  unmatched_revenue numeric(12,2) DEFAULT 0,
  
  -- Debug info
  errors jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

-- Index for querying by organization
CREATE INDEX IF NOT EXISTS idx_attribution_matcher_runs_org 
  ON attribution_matcher_runs(organization_id, started_at DESC);

-- Add comment explaining table purpose
COMMENT ON TABLE attribution_matcher_runs IS 
  'Audit log for attribution matcher runs. Used to verify idempotency and track match quality over time.';

-- ================================================================================
-- FIX EXISTING MISLABELED ATTRIBUTION RECORDS
-- ================================================================================
-- Some records with "Exact URL refcode match" were incorrectly marked as 
-- is_deterministic=false. This migration fixes those records.
-- ================================================================================

UPDATE campaign_attribution
SET 
  is_deterministic = true,
  attribution_type = 'deterministic_url_refcode'
WHERE match_reason LIKE 'Exact URL refcode match%'
  AND (is_deterministic = false OR is_deterministic IS NULL);

-- Also fix any records that have match_type indicators in match_reason
UPDATE campaign_attribution
SET 
  is_deterministic = true,
  attribution_type = 'deterministic_url_refcode'  
WHERE match_reason LIKE '%ad destination contains ?refcode=%'
  AND (is_deterministic = false OR is_deterministic IS NULL);

-- Ensure all records have an attribution_type
UPDATE campaign_attribution
SET attribution_type = 'unknown_legacy'
WHERE attribution_type IS NULL AND match_reason IS NOT NULL;

-- Add RLS policy for attribution_matcher_runs
ALTER TABLE attribution_matcher_runs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view runs for their organization
CREATE POLICY "Users can view attribution runs for their organization"
  ON attribution_matcher_runs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE id = auth.uid()
    )
  );

-- Allow service role to insert (edge functions)
CREATE POLICY "Service role can insert attribution runs"
  ON attribution_matcher_runs
  FOR INSERT
  WITH CHECK (true);