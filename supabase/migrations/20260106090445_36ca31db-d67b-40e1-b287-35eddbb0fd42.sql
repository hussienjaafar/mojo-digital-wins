-- Phase 3: Add rank_score field for Twitter-like trending ranking
-- This score prioritizes: burst above baseline > corroboration > recency > volume

-- Add rank_score column to trend_events
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS rank_score numeric DEFAULT 0;

-- Add evergreen_penalty column to track suppression factor
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS evergreen_penalty numeric DEFAULT 1.0;

-- Add recency_decay column for transparency
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS recency_decay numeric DEFAULT 1.0;

-- Create index for efficient ranking queries
CREATE INDEX IF NOT EXISTS idx_trend_events_rank_score 
ON public.trend_events(rank_score DESC) 
WHERE is_trending = true;

-- Create index for recency-based queries
CREATE INDEX IF NOT EXISTS idx_trend_events_last_seen_rank 
ON public.trend_events(last_seen_at DESC, rank_score DESC);

-- Update trend_quality_kpis view to include rank_score metrics
DROP VIEW IF EXISTS trend_quality_kpis;
CREATE VIEW trend_quality_kpis AS
WITH recent_trends AS (
  SELECT * FROM trend_events 
  WHERE last_seen_at > NOW() - INTERVAL '24 hours'
),
evidence_stats AS (
  SELECT 
    te.id,
    COUNT(tev.id) as evidence_count,
    COUNT(CASE WHEN tev.source_type = 'article' THEN 1 END) as tier1_evidence,
    COUNT(CASE WHEN tev.source_type = 'google_news' THEN 1 END) as tier2_evidence,
    COUNT(CASE WHEN tev.source_type = 'bluesky' THEN 1 END) as tier3_evidence
  FROM recent_trends te
  LEFT JOIN trend_evidence tev ON tev.event_id = te.id
  GROUP BY te.id
)
SELECT 
  COUNT(*) as total_trends_24h,
  ROUND(AVG(es.evidence_count)::numeric, 2) as avg_evidence_count,
  ROUND(100.0 * COUNT(CASE WHEN rt.source_count >= 2 THEN 1 END) / NULLIF(COUNT(*), 0), 1) as pct_trends_multi_source,
  ROUND(100.0 * COUNT(CASE WHEN rt.has_tier12_corroboration THEN 1 END) / NULLIF(COUNT(*), 0), 1) as pct_trends_tier1_corroborated,
  ROUND(100.0 * COUNT(CASE WHEN rt.label_quality = 'entity_only' AND array_length(string_to_array(rt.event_title, ' '), 1) = 1 THEN 1 END) / NULLIF(COUNT(*), 0), 1) as pct_trends_single_word,
  ROUND(AVG(rt.velocity)::numeric, 2) as avg_velocity,
  ROUND(AVG(rt.z_score_velocity)::numeric, 2) as avg_z_score,
  ROUND(AVG(rt.confidence_score)::numeric, 2) as avg_confidence_score,
  ROUND(AVG(rt.weighted_evidence_score)::numeric, 2) as avg_weighted_evidence_score,
  ROUND(100.0 * SUM(es.tier1_evidence) / NULLIF(SUM(es.evidence_count), 0), 1) as pct_evidence_tier1,
  ROUND(100.0 * SUM(es.tier2_evidence) / NULLIF(SUM(es.evidence_count), 0), 1) as pct_evidence_tier2,
  ROUND(100.0 * SUM(es.tier3_evidence) / NULLIF(SUM(es.evidence_count), 0), 1) as pct_evidence_tier3,
  -- Phase 3: Rank score metrics
  ROUND(AVG(rt.rank_score)::numeric, 2) as avg_rank_score,
  ROUND(AVG(rt.recency_decay)::numeric, 3) as avg_recency_decay,
  ROUND(AVG(rt.evergreen_penalty)::numeric, 3) as avg_evergreen_penalty,
  COUNT(CASE WHEN rt.evergreen_penalty < 1.0 THEN 1 END) as evergreen_suppressed_count,
  ROUND(100.0 * COUNT(CASE WHEN rt.rank_score >= 50 THEN 1 END) / NULLIF(COUNT(*), 0), 1) as pct_high_rank_score
FROM recent_trends rt
LEFT JOIN evidence_stats es ON es.id = rt.id;

-- Update trend_quality_flags view to include rank_score
DROP VIEW IF EXISTS trend_quality_flags;
CREATE VIEW trend_quality_flags AS
WITH recent_trends AS (
  SELECT * FROM trend_events 
  WHERE last_seen_at > NOW() - INTERVAL '24 hours'
  ORDER BY rank_score DESC NULLS LAST, confidence_score DESC
  LIMIT 50
),
evidence_counts AS (
  SELECT 
    te.id,
    COUNT(tev.id) as evidence_count,
    COUNT(CASE WHEN tev.source_type = 'article' THEN 1 END) as tier1_count,
    COUNT(CASE WHEN tev.source_type = 'google_news' THEN 1 END) as tier2_count,
    COUNT(CASE WHEN tev.source_type = 'bluesky' THEN 1 END) as tier3_count
  FROM recent_trends te
  LEFT JOIN trend_evidence tev ON tev.event_id = te.id
  GROUP BY te.id
)
SELECT 
  rt.id as trend_id,
  rt.event_title,
  rt.label_quality,
  ec.evidence_count,
  ec.tier1_count,
  ec.tier2_count,
  ec.tier3_count,
  -- Quality flags
  CASE WHEN array_length(string_to_array(rt.event_title, ' '), 1) = 1 THEN true ELSE false END as single_word_flag,
  CASE WHEN ec.tier1_count + ec.tier2_count < 1 THEN true ELSE false END as low_corroboration_flag,
  CASE WHEN ec.tier1_count = 0 AND ec.tier2_count = 0 AND ec.tier3_count > 0 THEN true ELSE false END as tier3_only_flag,
  CASE WHEN rt.last_seen_at < NOW() - INTERVAL '12 hours' THEN true ELSE false END as stale_flag,
  CASE WHEN ec.evidence_count < 3 THEN true ELSE false END as low_evidence_flag,
  CASE WHEN rt.confidence_score < 30 THEN true ELSE false END as low_confidence_flag,
  -- Phase 3: Rank score flags
  CASE WHEN rt.evergreen_penalty < 1.0 THEN true ELSE false END as evergreen_suppressed_flag,
  CASE WHEN rt.recency_decay < 0.5 THEN true ELSE false END as stale_recency_flag,
  CASE WHEN rt.z_score_velocity < 1.0 THEN true ELSE false END as low_burst_flag,
  -- Scores for analysis
  rt.rank_score,
  rt.z_score_velocity,
  rt.confidence_score,
  rt.recency_decay,
  rt.evergreen_penalty,
  -- Quality score (higher = better quality)
  ROUND((
    CASE WHEN rt.label_quality = 'event_phrase' THEN 30 ELSE 0 END +
    CASE WHEN ec.tier1_count > 0 THEN 25 ELSE 0 END +
    CASE WHEN ec.tier2_count > 0 THEN 15 ELSE 0 END +
    CASE WHEN ec.evidence_count >= 5 THEN 15 ELSE ec.evidence_count * 3 END +
    CASE WHEN rt.last_seen_at > NOW() - INTERVAL '6 hours' THEN 15 ELSE 0 END +
    CASE WHEN rt.z_score_velocity >= 2.0 THEN 20 ELSE rt.z_score_velocity * 10 END
  )::numeric, 0) as quality_score,
  -- Flag count (lower = better)
  (
    CASE WHEN array_length(string_to_array(rt.event_title, ' '), 1) = 1 THEN 1 ELSE 0 END +
    CASE WHEN ec.tier1_count + ec.tier2_count < 1 THEN 1 ELSE 0 END +
    CASE WHEN ec.tier1_count = 0 AND ec.tier2_count = 0 AND ec.tier3_count > 0 THEN 1 ELSE 0 END +
    CASE WHEN rt.last_seen_at < NOW() - INTERVAL '12 hours' THEN 1 ELSE 0 END +
    CASE WHEN ec.evidence_count < 3 THEN 1 ELSE 0 END +
    CASE WHEN rt.confidence_score < 30 THEN 1 ELSE 0 END +
    CASE WHEN rt.evergreen_penalty < 1.0 THEN 1 ELSE 0 END +
    CASE WHEN rt.z_score_velocity < 1.0 THEN 1 ELSE 0 END
  ) as flag_count
FROM recent_trends rt
LEFT JOIN evidence_counts ec ON ec.id = rt.id
ORDER BY rt.rank_score DESC NULLS LAST;