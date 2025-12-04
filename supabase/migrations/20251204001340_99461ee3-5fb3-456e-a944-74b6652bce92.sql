
-- Create enhanced unified trends view with baseline spike detection
DROP MATERIALIZED VIEW IF EXISTS public.mv_unified_trends CASCADE;

CREATE MATERIALIZED VIEW public.mv_unified_trends AS
WITH evergreen AS (
  SELECT LOWER(topic) as topic FROM public.evergreen_topics
),
-- News trends (from extract-trending-topics) - these are already good quality
news_trends AS (
  SELECT 
    topic as name,
    LOWER(TRIM(topic)) as normalized_name,
    'news' as source_type,
    'trending_topics' as source,
    COALESCE(velocity_score, 0) as velocity,
    mention_count as mentions_1h,
    mention_count * 6 as mentions_24h_est,
    NULL::NUMERIC as sentiment,
    hour_timestamp as last_updated
  FROM public.trending_topics
  WHERE hour_timestamp >= NOW() - INTERVAL '6 hours'
    AND LOWER(topic) NOT IN (SELECT topic FROM evergreen)
    AND topic ~ '^[A-Z]'
),
-- Social trends (from analyze-bluesky-posts)
social_trends AS (
  SELECT 
    topic as name,
    LOWER(TRIM(topic)) as normalized_name,
    'social' as source_type,
    'bluesky' as source,
    LEAST(COALESCE(velocity, 0), 500) as velocity,
    mentions_last_hour as mentions_1h,
    mentions_last_24_hours as mentions_24h_est,
    sentiment_avg as sentiment,
    calculated_at as last_updated
  FROM public.bluesky_trends
  WHERE is_trending = true
    AND LOWER(topic) NOT IN (SELECT topic FROM evergreen)
    AND topic ~ '^[A-Z]'
    AND mentions_last_24_hours >= 3
),
-- Combine and aggregate by normalized name
combined AS (
  SELECT 
    name,
    normalized_name,
    ARRAY_AGG(DISTINCT source_type) as source_types,
    ARRAY_AGG(DISTINCT source) as sources,
    MAX(velocity) as max_velocity,
    AVG(velocity) as avg_velocity,
    SUM(mentions_1h) as total_mentions_1h,
    SUM(mentions_24h_est) as total_mentions_24h,
    AVG(sentiment) as avg_sentiment,
    MAX(last_updated) as last_updated,
    COUNT(DISTINCT source_type) as source_count
  FROM (
    SELECT * FROM news_trends
    UNION ALL
    SELECT * FROM social_trends
  ) all_trends
  GROUP BY name, normalized_name
),
-- Add baseline comparison for spike detection
with_baseline AS (
  SELECT 
    c.*,
    COALESCE(b.avg_hourly_mentions, 0) as baseline_hourly,
    COALESCE(b.avg_daily_mentions, 0) as baseline_daily,
    CASE 
      WHEN COALESCE(b.avg_hourly_mentions, 0) > 0 
      THEN ROUND((c.total_mentions_1h / b.avg_hourly_mentions)::NUMERIC, 2)
      ELSE 10.0  -- New topics get high spike ratio
    END as spike_ratio
  FROM combined c
  LEFT JOIN public.topic_baselines b ON c.normalized_name = b.normalized_name
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY 
    -- Twitter-like scoring: spike ratio * recency * multi-source bonus
    (spike_ratio * 
     CASE WHEN source_count >= 2 THEN 2.0 ELSE 1.0 END *
     total_mentions_1h) DESC
  ) as id,
  name,
  normalized_name,
  source_types,
  sources,
  max_velocity,
  avg_velocity,
  total_mentions_1h,
  total_mentions_24h,
  avg_sentiment,
  last_updated,
  source_count,
  spike_ratio,
  baseline_hourly,
  baseline_daily,
  -- Twitter-like unified score
  ROUND(
    (spike_ratio * 10) + 
    (total_mentions_1h * 5) + 
    (max_velocity * 0.5) +
    (CASE WHEN source_count >= 2 THEN 50 ELSE 0 END)
  , 2) as unified_score,
  -- Is breakthrough: spike ratio > 3x AND new in last 2 hours
  (spike_ratio >= 3 AND total_mentions_1h >= 3) as is_breakthrough,
  NOW() as refreshed_at
FROM with_baseline
WHERE total_mentions_1h >= 1
ORDER BY unified_score DESC
LIMIT 50;

-- Create index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_unified_trends_id ON public.mv_unified_trends(id);

-- Grant access
GRANT SELECT ON public.mv_unified_trends TO anon, authenticated;
