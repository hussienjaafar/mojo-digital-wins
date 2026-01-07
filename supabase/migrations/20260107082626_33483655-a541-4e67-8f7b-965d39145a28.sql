-- Fix trend_events_active view to include rank_score and other missing columns
-- This enables proper client-side ordering by rank_score instead of fallback to trend_score

DROP VIEW IF EXISTS trend_events_active;

CREATE VIEW trend_events_active AS
SELECT 
  id, event_key, event_title, canonical_label, is_event_phrase,
  related_phrases, alias_variants, first_seen_at, last_seen_at, peak_at,
  baseline_7d, baseline_30d, current_1h, current_6h, current_24h,
  velocity, velocity_1h, velocity_6h, acceleration,
  trend_score, z_score_velocity, confidence_score, confidence_factors,
  is_trending, is_breaking, is_verified, trend_stage,
  source_count, news_source_count, social_source_count, corroboration_score,
  entity_type, related_topics, evidence_count, top_headline,
  sentiment_score, sentiment_label,
  -- Tier fields
  tier1_count, tier2_count, tier3_count,
  weighted_evidence_score, has_tier12_corroboration, is_tier3_only,
  -- Previously missing ranking fields
  rank_score,
  label_quality,
  evergreen_penalty,
  recency_decay,
  related_entities,
  updated_at
FROM trend_events
WHERE is_trending = true
  AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY is_breaking DESC, rank_score DESC NULLS LAST, confidence_score DESC;