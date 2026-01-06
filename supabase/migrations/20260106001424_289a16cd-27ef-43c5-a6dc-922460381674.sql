-- Coverage governance view: aggregates sources by tier, tag, and source_type
-- Combines data from rss_sources and google_news_sources

CREATE OR REPLACE VIEW source_coverage_summary AS
WITH unified_sources AS (
  -- RSS Sources
  SELECT 
    id,
    name,
    'rss'::text AS src_type,
    COALESCE(tier, 'unclassified') AS tier,
    COALESCE(tags, ARRAY[]::text[]) AS tags,
    is_active,
    last_fetched_at,
    last_success_at,
    consecutive_errors,
    expected_cadence_mins
  FROM rss_sources
  
  UNION ALL
  
  -- Google News Sources  
  SELECT
    id,
    name,
    'google_news'::text AS src_type,
    COALESCE(tier, 'unclassified') AS tier,
    COALESCE(tags, ARRAY[]::text[]) AS tags,
    is_active,
    last_fetched_at,
    last_success_at,
    consecutive_errors,
    expected_cadence_mins
  FROM google_news_sources
),

-- Expand tags for per-tag counting
expanded_tags AS (
  SELECT 
    id,
    name,
    src_type,
    tier,
    is_active,
    last_fetched_at,
    last_success_at,
    consecutive_errors,
    expected_cadence_mins,
    UNNEST(CASE WHEN array_length(tags, 1) > 0 THEN tags ELSE ARRAY['untagged'] END) AS tag
  FROM unified_sources
)

SELECT
  src_type AS source_type,
  tier,
  tag,
  COUNT(*) AS source_count,
  COUNT(*) FILTER (WHERE is_active = true) AS active_count,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_count,
  COUNT(*) FILTER (WHERE consecutive_errors > 0) AS sources_with_errors,
  COUNT(*) FILTER (WHERE last_success_at > NOW() - INTERVAL '24 hours') AS healthy_24h,
  COUNT(*) FILTER (WHERE last_success_at <= NOW() - INTERVAL '24 hours' OR last_success_at IS NULL) AS stale_24h,
  AVG(consecutive_errors)::numeric(10,2) AS avg_consecutive_errors,
  AVG(expected_cadence_mins)::numeric(10,2) AS avg_expected_cadence_mins,
  -- Coverage score: % of sources that are active AND healthy
  CASE 
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE is_active = true AND last_success_at > NOW() - INTERVAL '24 hours'))::numeric 
      / COUNT(*)::numeric * 100, 
      1
    )
  END AS coverage_score
FROM expanded_tags
GROUP BY src_type, tier, tag
ORDER BY src_type, tier, tag;

-- Summary view for quick KPIs
CREATE OR REPLACE VIEW source_coverage_kpis AS
WITH unified AS (
  SELECT 
    id,
    'rss'::text AS src_type,
    COALESCE(tier, 'unclassified') AS tier,
    is_active,
    last_success_at,
    consecutive_errors
  FROM rss_sources
  UNION ALL
  SELECT
    id,
    'google_news'::text AS src_type,
    COALESCE(tier, 'unclassified') AS tier,
    is_active,
    last_success_at,
    consecutive_errors
  FROM google_news_sources
)
SELECT
  COUNT(DISTINCT id) AS total_sources,
  COUNT(*) FILTER (WHERE is_active = true) AS active_sources,
  COUNT(*) FILTER (WHERE is_active = false) AS inactive_sources,
  COUNT(*) FILTER (WHERE last_success_at > NOW() - INTERVAL '24 hours') AS healthy_sources,
  COUNT(*) FILTER (WHERE last_success_at <= NOW() - INTERVAL '24 hours' OR last_success_at IS NULL) AS stale_sources,
  COUNT(*) FILTER (WHERE consecutive_errors >= 3) AS failing_sources,
  -- Tier breakdown
  COUNT(*) FILTER (WHERE tier = 'tier1') AS tier1_count,
  COUNT(*) FILTER (WHERE tier = 'tier2') AS tier2_count,
  COUNT(*) FILTER (WHERE tier = 'tier3') AS tier3_count,
  COUNT(*) FILTER (WHERE tier = 'unclassified') AS unclassified_count,
  -- Source type breakdown
  COUNT(*) FILTER (WHERE src_type = 'rss') AS rss_count,
  COUNT(*) FILTER (WHERE src_type = 'google_news') AS google_news_count,
  -- Overall coverage score
  CASE 
    WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE is_active = true AND last_success_at > NOW() - INTERVAL '24 hours'))::numeric 
      / COUNT(*)::numeric * 100, 
      1
    )
  END AS overall_coverage_score
FROM unified;