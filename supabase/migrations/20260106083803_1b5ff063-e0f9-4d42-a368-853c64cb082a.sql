-- Phase 5: Trend Quality Validation and Diagnostics
-- Creates views for monitoring trend quality metrics and flagging low-quality trends

-- View 1: Aggregated KPIs for trend quality (last 24 hours)
CREATE OR REPLACE VIEW public.trend_quality_kpis AS
SELECT
  -- Total trends in last 24h
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS total_trends_24h,
  
  -- Average evidence count
  ROUND(AVG(COALESCE(evidence_count, 0))::numeric, 2) AS avg_evidence_count,
  
  -- Percentage of trends with multiple sources (evidence_count >= 2)
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE COALESCE(evidence_count, 0) >= 2 AND created_at >= NOW() - INTERVAL '24 hours') 
    / NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0),
    1
  ) AS pct_trends_multi_source,
  
  -- Percentage of trends with tier1 corroboration
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE COALESCE(tier1_count, 0) >= 1 AND created_at >= NOW() - INTERVAL '24 hours')
    / NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0),
    1
  ) AS pct_trends_tier1_corroborated,
  
  -- Percentage of trends with tier1 OR tier2 corroboration
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE (COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0)) >= 1 AND created_at >= NOW() - INTERVAL '24 hours')
    / NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0),
    1
  ) AS pct_trends_tier12_corroborated,
  
  -- Percentage of single-word trends (potential low quality)
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE array_length(string_to_array(trim(event_title), ' '), 1) = 1 AND created_at >= NOW() - INTERVAL '24 hours')
    / NULLIF(COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours'), 0),
    1
  ) AS pct_trends_single_word,
  
  -- Average velocity
  ROUND(AVG(COALESCE(velocity, 0))::numeric, 2) AS avg_velocity,
  
  -- Average z-score (velocity)
  ROUND(AVG(COALESCE(z_score_velocity, 0))::numeric, 2) AS avg_z_score,
  
  -- Average confidence score
  ROUND(AVG(COALESCE(confidence_score, 0))::numeric, 2) AS avg_confidence_score,
  
  -- Average weighted evidence score
  ROUND(AVG(COALESCE(weighted_evidence_score, 0))::numeric, 2) AS avg_weighted_evidence_score,
  
  -- Tier distribution (percentage)
  ROUND(
    100.0 * SUM(COALESCE(tier1_count, 0)) / NULLIF(SUM(COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0) + COALESCE(tier3_count, 0)), 0),
    1
  ) AS pct_evidence_tier1,
  
  ROUND(
    100.0 * SUM(COALESCE(tier2_count, 0)) / NULLIF(SUM(COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0) + COALESCE(tier3_count, 0)), 0),
    1
  ) AS pct_evidence_tier2,
  
  ROUND(
    100.0 * SUM(COALESCE(tier3_count, 0)) / NULLIF(SUM(COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0) + COALESCE(tier3_count, 0)), 0),
    1
  ) AS pct_evidence_tier3,
  
  -- Timestamp
  NOW() AS calculated_at
FROM public.trend_events
WHERE created_at >= NOW() - INTERVAL '7 days';

-- View 2: Top 50 trends with quality flags
CREATE OR REPLACE VIEW public.trend_quality_flags AS
SELECT
  id AS trend_id,
  event_title,
  canonical_label,
  COALESCE(evidence_count, 0) AS evidence_count,
  COALESCE(tier1_count, 0) AS tier1_count,
  COALESCE(tier2_count, 0) AS tier2_count,
  COALESCE(tier3_count, 0) AS tier3_count,
  COALESCE(weighted_evidence_score, 0) AS weighted_evidence_score,
  COALESCE(velocity, 0) AS velocity,
  COALESCE(z_score_velocity, 0) AS z_score,
  COALESCE(confidence_score, 0) AS confidence_score,
  is_trending,
  is_breaking,
  trend_stage,
  first_seen_at,
  last_seen_at,
  
  -- Quality flags
  -- Single word flag: event_title has only 1 word
  (array_length(string_to_array(trim(event_title), ' '), 1) = 1) AS single_word_flag,
  
  -- Low corroboration flag: no tier1 or tier2 sources
  ((COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0)) = 0) AS low_corroboration_flag,
  
  -- Tier3 only flag
  COALESCE(is_tier3_only, false) AS tier3_only_flag,
  
  -- Stale flag: last seen more than 12 hours ago
  (last_seen_at < NOW() - INTERVAL '12 hours') AS stale_flag,
  
  -- Low evidence flag: only 1 piece of evidence
  (COALESCE(evidence_count, 0) <= 1) AS low_evidence_flag,
  
  -- Low confidence flag: confidence below 0.3
  (COALESCE(confidence_score, 0) < 0.3) AS low_confidence_flag,
  
  -- Aggregate quality score (higher = better quality)
  CASE 
    WHEN COALESCE(evidence_count, 0) = 0 THEN 0
    ELSE ROUND(
      (
        -- Evidence contribution (max 30 points)
        LEAST(COALESCE(evidence_count, 0) * 5, 30) +
        -- Tier1 contribution (max 25 points)
        LEAST(COALESCE(tier1_count, 0) * 15, 25) +
        -- Tier2 contribution (max 20 points)
        LEAST(COALESCE(tier2_count, 0) * 10, 20) +
        -- Confidence contribution (max 15 points)
        COALESCE(confidence_score, 0) * 15 +
        -- Freshness contribution (max 10 points)
        CASE WHEN last_seen_at >= NOW() - INTERVAL '6 hours' THEN 10
             WHEN last_seen_at >= NOW() - INTERVAL '12 hours' THEN 5
             ELSE 0 END
      )::numeric,
      1
    )
  END AS quality_score,
  
  -- Count of flags triggered
  (
    (CASE WHEN array_length(string_to_array(trim(event_title), ' '), 1) = 1 THEN 1 ELSE 0 END) +
    (CASE WHEN (COALESCE(tier1_count, 0) + COALESCE(tier2_count, 0)) = 0 THEN 1 ELSE 0 END) +
    (CASE WHEN last_seen_at < NOW() - INTERVAL '12 hours' THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(evidence_count, 0) <= 1 THEN 1 ELSE 0 END) +
    (CASE WHEN COALESCE(confidence_score, 0) < 0.3 THEN 1 ELSE 0 END)
  ) AS flag_count

FROM public.trend_events
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY 
  is_trending DESC,
  trend_score DESC NULLS LAST,
  last_seen_at DESC
LIMIT 50;

-- Add comment for documentation
COMMENT ON VIEW public.trend_quality_kpis IS 'Aggregated trend quality metrics for monitoring source registry health';
COMMENT ON VIEW public.trend_quality_flags IS 'Top 50 trends with quality flags to identify low-quality or under-corroborated trends';