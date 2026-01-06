-- Phase 2: Add label_quality field to track trend label source quality
-- Values: 'event_phrase' (AI-extracted multi-word), 'entity_only' (single entity), 'fallback_generated' (headline-derived)

-- Add label_quality to trend_events table
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS label_quality text DEFAULT 'entity_only';

-- Add related_entities to store entities that contributed to the event phrase
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS related_entities text[] DEFAULT '{}';

-- Add constraint for label_quality values
ALTER TABLE public.trend_events 
ADD CONSTRAINT trend_events_label_quality_check 
CHECK (label_quality IN ('event_phrase', 'entity_only', 'fallback_generated'));

-- Update trend_quality_flags view to include label_quality
DROP VIEW IF EXISTS trend_quality_flags;

CREATE VIEW trend_quality_flags AS
WITH trend_evidence_stats AS (
  SELECT 
    te.event_key,
    te.event_title,
    te.label_quality,
    te.is_event_phrase,
    te.evidence_count,
    te.confidence_score,
    te.z_score_velocity,
    te.trend_score,
    te.tier1_count,
    te.tier2_count,
    te.tier3_count,
    te.last_seen_at,
    te.first_seen_at,
    te.is_trending,
    te.related_entities
  FROM trend_events te
  WHERE te.last_seen_at > NOW() - INTERVAL '24 hours'
)
SELECT
  tes.event_key as trend_id,
  tes.event_title,
  tes.label_quality,
  tes.evidence_count,
  tes.tier1_count,
  tes.tier2_count,
  tes.tier3_count,
  -- Quality flags
  CASE WHEN array_length(regexp_split_to_array(tes.event_title, '\s+'), 1) = 1 THEN true ELSE false END as single_word_flag,
  CASE WHEN tes.tier1_count + tes.tier2_count = 0 THEN true ELSE false END as low_corroboration_flag,
  CASE WHEN tes.tier1_count + tes.tier2_count + tes.tier3_count = tes.tier3_count AND tes.tier3_count > 0 THEN true ELSE false END as tier3_only_flag,
  CASE WHEN tes.last_seen_at < NOW() - INTERVAL '12 hours' THEN true ELSE false END as stale_flag,
  CASE WHEN tes.evidence_count < 3 THEN true ELSE false END as low_evidence_flag,
  CASE WHEN tes.confidence_score < 30 THEN true ELSE false END as low_confidence_flag,
  CASE WHEN tes.label_quality = 'entity_only' AND tes.is_event_phrase = false THEN true ELSE false END as entity_only_label_flag,
  CASE WHEN tes.label_quality = 'fallback_generated' THEN true ELSE false END as fallback_label_flag,
  -- Quality score (higher = better, 100 max)
  GREATEST(0, 
    100 
    - (CASE WHEN array_length(regexp_split_to_array(tes.event_title, '\s+'), 1) = 1 THEN 15 ELSE 0 END)
    - (CASE WHEN tes.tier1_count + tes.tier2_count = 0 THEN 20 ELSE 0 END)
    - (CASE WHEN tes.last_seen_at < NOW() - INTERVAL '12 hours' THEN 25 ELSE 0 END)
    - (CASE WHEN tes.evidence_count < 3 THEN 15 ELSE 0 END)
    - (CASE WHEN tes.confidence_score < 30 THEN 10 ELSE 0 END)
    - (CASE WHEN tes.label_quality = 'entity_only' THEN 10 ELSE 0 END)
    - (CASE WHEN tes.label_quality = 'fallback_generated' THEN 5 ELSE 0 END)
  ) as quality_score,
  -- Count flags
  (
    (CASE WHEN array_length(regexp_split_to_array(tes.event_title, '\s+'), 1) = 1 THEN 1 ELSE 0 END) +
    (CASE WHEN tes.tier1_count + tes.tier2_count = 0 THEN 1 ELSE 0 END) +
    (CASE WHEN tes.last_seen_at < NOW() - INTERVAL '12 hours' THEN 1 ELSE 0 END) +
    (CASE WHEN tes.evidence_count < 3 THEN 1 ELSE 0 END) +
    (CASE WHEN tes.confidence_score < 30 THEN 1 ELSE 0 END) +
    (CASE WHEN tes.label_quality = 'entity_only' THEN 1 ELSE 0 END)
  ) as flag_count,
  tes.is_trending,
  tes.z_score_velocity,
  tes.trend_score,
  tes.first_seen_at,
  tes.last_seen_at,
  array_length(tes.related_entities, 1) as related_entities_count
FROM trend_evidence_stats tes
ORDER BY tes.trend_score DESC NULLS LAST, tes.evidence_count DESC
LIMIT 50;

-- Update trend_quality_kpis to include label quality metrics
DROP VIEW IF EXISTS trend_quality_kpis;

CREATE VIEW trend_quality_kpis AS
WITH recent_trends AS (
  SELECT * FROM trend_events
  WHERE last_seen_at > NOW() - INTERVAL '24 hours'
),
evidence_stats AS (
  SELECT 
    COUNT(*) as total_trends_24h,
    AVG(evidence_count) as avg_evidence_count,
    COUNT(CASE WHEN source_count >= 2 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_trends_multi_source,
    COUNT(CASE WHEN tier1_count + tier2_count > 0 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_trends_tier1_corroborated,
    COUNT(CASE WHEN array_length(regexp_split_to_array(event_title, '\s+'), 1) = 1 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_trends_single_word,
    AVG(velocity) as avg_velocity,
    AVG(z_score_velocity) as avg_z_score,
    AVG(confidence_score) as avg_confidence_score,
    AVG(weighted_evidence_score) as avg_weighted_evidence_score,
    SUM(tier1_count)::float / NULLIF(SUM(tier1_count + tier2_count + tier3_count), 0) * 100 as pct_evidence_tier1,
    SUM(tier2_count)::float / NULLIF(SUM(tier1_count + tier2_count + tier3_count), 0) * 100 as pct_evidence_tier2,
    SUM(tier3_count)::float / NULLIF(SUM(tier1_count + tier2_count + tier3_count), 0) * 100 as pct_evidence_tier3,
    -- Label quality metrics
    COUNT(CASE WHEN label_quality = 'event_phrase' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_event_phrase_labels,
    COUNT(CASE WHEN label_quality = 'entity_only' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_entity_only_labels,
    COUNT(CASE WHEN label_quality = 'fallback_generated' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_fallback_labels,
    COUNT(CASE WHEN is_event_phrase = true THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100 as pct_multi_word_titles,
    AVG(array_length(related_entities, 1)) as avg_related_entities
  FROM recent_trends
)
SELECT
  COALESCE(total_trends_24h, 0) as total_trends_24h,
  ROUND(COALESCE(avg_evidence_count, 0)::numeric, 2) as avg_evidence_count,
  ROUND(COALESCE(pct_trends_multi_source, 0)::numeric, 1) as pct_trends_multi_source,
  ROUND(COALESCE(pct_trends_tier1_corroborated, 0)::numeric, 1) as pct_trends_tier1_corroborated,
  ROUND(COALESCE(pct_trends_single_word, 0)::numeric, 1) as pct_trends_single_word,
  ROUND(COALESCE(avg_velocity, 0)::numeric, 2) as avg_velocity,
  ROUND(COALESCE(avg_z_score, 0)::numeric, 2) as avg_z_score,
  ROUND(COALESCE(avg_confidence_score, 0)::numeric, 1) as avg_confidence_score,
  ROUND(COALESCE(avg_weighted_evidence_score, 0)::numeric, 1) as avg_weighted_evidence_score,
  ROUND(COALESCE(pct_evidence_tier1, 0)::numeric, 1) as pct_evidence_tier1,
  ROUND(COALESCE(pct_evidence_tier2, 0)::numeric, 1) as pct_evidence_tier2,
  ROUND(COALESCE(pct_evidence_tier3, 0)::numeric, 1) as pct_evidence_tier3,
  ROUND(COALESCE(pct_event_phrase_labels, 0)::numeric, 1) as pct_event_phrase_labels,
  ROUND(COALESCE(pct_entity_only_labels, 0)::numeric, 1) as pct_entity_only_labels,
  ROUND(COALESCE(pct_fallback_labels, 0)::numeric, 1) as pct_fallback_labels,
  ROUND(COALESCE(pct_multi_word_titles, 0)::numeric, 1) as pct_multi_word_titles,
  ROUND(COALESCE(avg_related_entities, 0)::numeric, 1) as avg_related_entities,
  NOW() as calculated_at
FROM evidence_stats;

-- Add comment for documentation
COMMENT ON COLUMN trend_events.label_quality IS 'Source of trend label: event_phrase (AI multi-word), entity_only (single entity), fallback_generated (headline-derived)';
COMMENT ON COLUMN trend_events.related_entities IS 'Single-word entities that contributed to the event phrase label';