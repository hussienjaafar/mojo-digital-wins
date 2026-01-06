-- Phase 2: Add tier distribution and weighted scoring fields to trend_events
-- These fields enable tier-weighted trend scoring and cross-tier corroboration requirements

-- Add tier distribution counts
ALTER TABLE public.trend_events 
  ADD COLUMN IF NOT EXISTS tier1_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier2_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier3_count integer DEFAULT 0;

-- Add weighted evidence score (based on tier + source_type weights)
ALTER TABLE public.trend_events 
  ADD COLUMN IF NOT EXISTS weighted_evidence_score numeric DEFAULT 0;

-- Add tier corroboration flag (true if tier1/tier2 source present)
ALTER TABLE public.trend_events 
  ADD COLUMN IF NOT EXISTS has_tier12_corroboration boolean DEFAULT false;

-- Add flag to indicate tier3-only evidence (for demotion)
ALTER TABLE public.trend_events 
  ADD COLUMN IF NOT EXISTS is_tier3_only boolean DEFAULT false;

-- Update the trend_events_active view to include new fields
DROP VIEW IF EXISTS trend_events_active;
CREATE VIEW trend_events_active AS
SELECT 
  id,
  event_key,
  event_title,
  canonical_label,
  is_event_phrase,
  related_phrases,
  alias_variants,
  first_seen_at,
  last_seen_at,
  peak_at,
  baseline_7d,
  baseline_30d,
  current_1h,
  current_6h,
  current_24h,
  velocity,
  velocity_1h,
  velocity_6h,
  acceleration,
  trend_score,
  z_score_velocity,
  confidence_score,
  confidence_factors,
  is_trending,
  is_breaking,
  is_verified,
  trend_stage,
  source_count,
  news_source_count,
  social_source_count,
  corroboration_score,
  entity_type,
  related_topics,
  evidence_count,
  top_headline,
  sentiment_score,
  sentiment_label,
  -- New tier fields
  tier1_count,
  tier2_count,
  tier3_count,
  weighted_evidence_score,
  has_tier12_corroboration,
  is_tier3_only,
  updated_at
FROM trend_events
WHERE is_trending = true
  AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY trend_score DESC, z_score_velocity DESC;