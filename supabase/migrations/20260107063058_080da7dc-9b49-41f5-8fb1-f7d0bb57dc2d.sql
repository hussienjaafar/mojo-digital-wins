-- ============================================================================
-- Label Quality Audit Views
-- Purpose: Monitor trend label quality to detect regressions
-- ============================================================================

-- View 1: Label Quality KPIs (single row summary)
CREATE OR REPLACE VIEW public.label_quality_kpis AS
WITH recent_trends AS (
  SELECT 
    id,
    event_title,
    canonical_label,
    confidence_factors,
    is_event_phrase,
    evidence_count,
    source_count,
    last_seen_at,
    -- Determine label_quality from confidence_factors or infer
    COALESCE(
      (confidence_factors->>'label_quality')::text,
      CASE 
        WHEN is_event_phrase = true THEN 'event_phrase'
        WHEN array_length(string_to_array(event_title, ' '), 1) >= 3 
             AND event_title ~* '\y(passes|blocks|signs|announces|launches|faces|wins|loses|approves|rejects|votes|introduces|proposes|bans|lifts|orders|rules|confirms|nominates|fires|hires|resigns|impeaches|indicts|arrests|convicts|sentences|pardons|vetoes|overrides|sanctions|tariffs|invades|attacks|strikes|bombs|kills|rescues|evacuates|declares|warns|threatens|accuses|denies|admits|reveals|leaks|exposes|investigates|probes|raids|seizes|freezes|releases|publishes|reports|announces|unveils|launches|rolls out|shuts down|suspends|delays|cancels|postpones|reverses|overturns|upholds|strikes down|invalidates|certifies|ratifies|amends|repeals|extends|expires|renews|funds|defunds|cuts|raises|lowers|increases|decreases|surges|plummets|crashes|rallies|soars|tanks|spikes|drops)\y'
        THEN 'event_phrase'
        WHEN array_length(string_to_array(event_title, ' '), 1) = 1 THEN 'entity_only'
        WHEN array_length(string_to_array(event_title, ' '), 1) = 2 THEN 'entity_only'
        ELSE 'fallback_generated'
      END
    ) AS label_quality
  FROM public.trend_events
  WHERE last_seen_at >= now() - interval '24 hours'
    AND confidence_score >= 20
)
SELECT
  COUNT(*) AS total_trends_24h,
  COUNT(*) FILTER (WHERE label_quality = 'event_phrase') AS event_phrase_count,
  COUNT(*) FILTER (WHERE label_quality = 'fallback_generated') AS fallback_count,
  COUNT(*) FILTER (WHERE label_quality = 'entity_only') AS entity_only_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE label_quality = 'event_phrase') / NULLIF(COUNT(*), 0),
    1
  ) AS event_phrase_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE label_quality = 'fallback_generated') / NULLIF(COUNT(*), 0),
    1
  ) AS fallback_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE label_quality = 'entity_only') / NULLIF(COUNT(*), 0),
    1
  ) AS entity_only_pct,
  -- Quality score: higher is better (event phrases are best)
  ROUND(
    (100.0 * COUNT(*) FILTER (WHERE label_quality = 'event_phrase') 
     + 50.0 * COUNT(*) FILTER (WHERE label_quality = 'fallback_generated')
     + 0.0 * COUNT(*) FILTER (WHERE label_quality = 'entity_only')
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS quality_score,
  now() AS calculated_at
FROM recent_trends;

-- View 2: Label Quality Flags (top 50 trends with quality details)
CREATE OR REPLACE VIEW public.label_quality_flags AS
WITH trend_quality AS (
  SELECT 
    id AS trend_id,
    event_title,
    canonical_label,
    evidence_count,
    source_count,
    rank_score,
    trend_score,
    confidence_score,
    is_breaking,
    is_event_phrase,
    last_seen_at,
    first_seen_at,
    -- Determine label_quality
    COALESCE(
      (confidence_factors->>'label_quality')::text,
      CASE 
        WHEN is_event_phrase = true THEN 'event_phrase'
        WHEN array_length(string_to_array(event_title, ' '), 1) >= 3 
             AND event_title ~* '\y(passes|blocks|signs|announces|launches|faces|wins|loses|approves|rejects|votes|introduces|proposes|bans|lifts|orders|rules|confirms|nominates|fires|hires|resigns|impeaches|indicts|arrests|convicts|sentences|pardons|vetoes|overrides|sanctions|tariffs|invades|attacks|strikes|bombs|kills|rescues|evacuates|declares|warns|threatens|accuses|denies|admits|reveals|leaks|exposes|investigates|probes|raids|seizes|freezes|releases|publishes|reports|announces|unveils|launches|rolls out|shuts down|suspends|delays|cancels|postpones|reverses|overturns|upholds|strikes down|invalidates|certifies|ratifies|amends|repeals|extends|expires|renews|funds|defunds|cuts|raises|lowers|increases|decreases|surges|plummets|crashes|rallies|soars|tanks|spikes|drops)\y'
        THEN 'event_phrase'
        WHEN array_length(string_to_array(event_title, ' '), 1) = 1 THEN 'entity_only'
        WHEN array_length(string_to_array(event_title, ' '), 1) = 2 THEN 'entity_only'
        ELSE 'fallback_generated'
      END
    ) AS label_quality,
    array_length(string_to_array(event_title, ' '), 1) AS word_count
  FROM public.trend_events
  WHERE last_seen_at >= now() - interval '24 hours'
    AND confidence_score >= 20
)
SELECT 
  trend_id,
  event_title,
  canonical_label,
  label_quality,
  word_count,
  evidence_count,
  source_count,
  rank_score,
  trend_score,
  confidence_score,
  is_breaking,
  last_seen_at,
  first_seen_at,
  -- Flag weak labels for attention
  CASE 
    WHEN label_quality = 'entity_only' THEN true
    WHEN label_quality = 'fallback_generated' AND word_count <= 2 THEN true
    ELSE false
  END AS needs_attention
FROM trend_quality
ORDER BY 
  CASE label_quality 
    WHEN 'entity_only' THEN 1 
    WHEN 'fallback_generated' THEN 2 
    ELSE 3 
  END,
  rank_score DESC NULLS LAST
LIMIT 50;

-- Add comments for documentation
COMMENT ON VIEW public.label_quality_kpis IS 'Single-row summary of trend label quality metrics over last 24h. Quality score: 100=all event phrases, 50=all fallbacks, 0=all entity-only.';
COMMENT ON VIEW public.label_quality_flags IS 'Top 50 trends with label quality details, sorted by weak labels first. Use needs_attention flag to identify labels needing improvement.';