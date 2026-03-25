-- Phase 2 Schema Improvements Migration
-- Based on Audit Report Phase 2
-- Created: 2026-01-19

-- ============================================================================
-- 1. Add Unique Constraint to trend_campaign_correlations (MEDIUM)
-- ============================================================================

-- First check if the constraint already exists, then add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_trend_campaign_correlation'
    AND conrelid = 'trend_campaign_correlations'::regclass
  ) THEN
    -- Handle any existing duplicates by keeping the most recent
    WITH duplicates AS (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY trend_event_id, campaign_id
        ORDER BY created_at DESC
      ) as rn
      FROM trend_campaign_correlations
    )
    DELETE FROM trend_campaign_correlations
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

    -- Now add the unique constraint
    ALTER TABLE trend_campaign_correlations
    ADD CONSTRAINT unique_trend_campaign_correlation
    UNIQUE (trend_event_id, campaign_id);
  END IF;
END
$$;

-- ============================================================================
-- 2. Add GIN Indexes on Array Columns (MEDIUM)
-- ============================================================================

-- For trend_events array columns
CREATE INDEX IF NOT EXISTS idx_trend_events_politicians_gin
ON trend_events USING GIN (politicians_mentioned);

CREATE INDEX IF NOT EXISTS idx_trend_events_organizations_gin
ON trend_events USING GIN (organizations_mentioned);

CREATE INDEX IF NOT EXISTS idx_trend_events_legislation_gin
ON trend_events USING GIN (legislation_mentioned);

-- For campaign_topic_extractions array columns
CREATE INDEX IF NOT EXISTS idx_campaign_extractions_domains_gin
ON campaign_topic_extractions USING GIN (policy_domains);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_topics_gin
ON campaign_topic_extractions USING GIN (topics);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_entities_gin
ON campaign_topic_extractions USING GIN (entities);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_emotional_appeals_gin
ON campaign_topic_extractions USING GIN (emotional_appeals);

-- ============================================================================
-- 3. Add FK Constraint to campaign_analytics (MEDIUM)
-- ============================================================================

-- Only add if the constraint doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_campaign_analytics_org'
    AND conrelid = 'campaign_analytics'::regclass
  ) THEN
    -- First clean up any orphaned records
    DELETE FROM campaign_analytics
    WHERE organization_id NOT IN (
      SELECT id FROM client_organizations
    );

    -- Add the FK constraint
    ALTER TABLE campaign_analytics
    ADD CONSTRAINT fk_campaign_analytics_org
    FOREIGN KEY (organization_id)
    REFERENCES client_organizations(id)
    ON DELETE CASCADE;
  END IF;
END
$$;

-- ============================================================================
-- 4. Additional Performance Indexes (Recommended)
-- ============================================================================

-- Index for trend_outcome_correlation lookups
CREATE INDEX IF NOT EXISTS idx_trend_outcome_correlation_org_trend
ON trend_outcome_correlation (organization_id, trend_key);

-- Index for org_trend_scores lookups
CREATE INDEX IF NOT EXISTS idx_org_trend_scores_priority
ON org_trend_scores (organization_id, priority_bucket, relevance_score DESC);

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Add comments for documentation
COMMENT ON INDEX idx_trend_events_politicians_gin IS 'GIN index for searching politicians_mentioned array';
COMMENT ON INDEX idx_trend_events_organizations_gin IS 'GIN index for searching organizations_mentioned array';
COMMENT ON INDEX idx_campaign_extractions_domains_gin IS 'GIN index for searching policy_domains array';
