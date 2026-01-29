-- ==========================================================
-- ADD TOPIC COHERENCE SCORE TO meta_creative_insights
--
-- Tracks the coherence validation score from topic extraction
-- Part of Task 3: Implement Topic Extraction Validation with Coherence Scoring
--
-- Reference: docs/plans/2026-01-29-creative-intelligence-v2-remediation.md
-- ==========================================================

-- Add column for coherence scoring (0-1 scale, stored as 0.00-1.00)
ALTER TABLE meta_creative_insights
ADD COLUMN IF NOT EXISTS topic_coherence_score NUMERIC(3,2);

COMMENT ON COLUMN meta_creative_insights.topic_coherence_score IS
  'Topic extraction coherence score (0-1). Measures presence of expected fields and extraction quality. Higher = better extraction quality.';

-- Create index for querying by coherence score
CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_topic_coherence
  ON meta_creative_insights(topic_coherence_score)
  WHERE topic_coherence_score IS NOT NULL;

-- Update analysis_confidence column comment to reflect it's now dynamic
COMMENT ON COLUMN meta_creative_insights.analysis_confidence IS
  'Dynamic confidence score combining LLM self-rating and coherence validation (0-1). Replaces hardcoded 0.85 value. Formula: (confidence_rating/5) * coherence_score';
