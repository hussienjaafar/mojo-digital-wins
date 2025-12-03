
-- Drop and recreate with fixed syntax
DROP MATERIALIZED VIEW IF EXISTS public.mv_unified_trends CASCADE;

CREATE MATERIALIZED VIEW public.mv_unified_trends AS
WITH bluesky AS (
  SELECT 
    LOWER(TRIM(topic)) as normalized_name,
    topic as display_name,
    'social' as source_type,
    'bluesky' as source,
    velocity,
    mentions_last_hour as mentions_1h,
    mentions_last_24_hours as mentions_24h,
    sentiment_avg,
    calculated_at,
    COALESCE(velocity, 0) * 0.7 as weighted_velocity,
    CASE 
      WHEN calculated_at > NOW() - INTERVAL '1 hour' THEN 1.0
      WHEN calculated_at > NOW() - INTERVAL '3 hours' THEN 0.8
      WHEN calculated_at > NOW() - INTERVAL '6 hours' THEN 0.5
      ELSE 0.3
    END as recency_score
  FROM public.bluesky_trends
  WHERE is_trending = true OR mentions_last_24_hours >= 3
),
news AS (
  SELECT 
    LOWER(TRIM(topic)) as normalized_name,
    topic as display_name,
    'news' as source_type,
    'rss' as source,
    velocity,
    mentions_last_hour as mentions_1h,
    mentions_last_24_hours as mentions_24h,
    NULL::numeric as sentiment_avg,
    calculated_at,
    COALESCE(velocity, 0) * 1.0 as weighted_velocity,
    CASE 
      WHEN calculated_at > NOW() - INTERVAL '1 hour' THEN 1.0
      WHEN calculated_at > NOW() - INTERVAL '3 hours' THEN 0.8
      WHEN calculated_at > NOW() - INTERVAL '6 hours' THEN 0.5
      ELSE 0.3
    END as recency_score
  FROM public.trending_news_topics
  WHERE velocity >= 50 OR mentions_last_24_hours >= 2
),
entities AS (
  SELECT 
    LOWER(TRIM(entity_name)) as normalized_name,
    entity_name as display_name,
    'entity' as source_type,
    COALESCE(entity_type, 'topic') as source,
    velocity,
    0 as mentions_1h,
    mentions_24h as mentions_24h,
    sentiment_avg,
    calculated_at,
    COALESCE(velocity, 0) * 0.8 as weighted_velocity,
    CASE 
      WHEN calculated_at > NOW() - INTERVAL '1 hour' THEN 1.0
      WHEN calculated_at > NOW() - INTERVAL '3 hours' THEN 0.8
      WHEN calculated_at > NOW() - INTERVAL '6 hours' THEN 0.5
      ELSE 0.3
    END as recency_score
  FROM public.entity_trends
  WHERE is_trending = true OR mentions_24h >= 3
),
all_trends AS (
  SELECT * FROM bluesky
  UNION ALL
  SELECT * FROM news
  UNION ALL
  SELECT * FROM entities
),
aggregated AS (
  SELECT 
    normalized_name,
    MAX(display_name) as name,
    array_agg(DISTINCT source_type ORDER BY source_type) as source_types,
    array_agg(DISTINCT source ORDER BY source) FILTER (WHERE source IS NOT NULL) as sources,
    MAX(velocity) as max_velocity,
    ROUND(AVG(velocity)::numeric, 1) as avg_velocity,
    SUM(COALESCE(mentions_1h, 0)) as total_mentions_1h,
    SUM(COALESCE(mentions_24h, 0)) as total_mentions_24h,
    ROUND((AVG(sentiment_avg) FILTER (WHERE sentiment_avg IS NOT NULL))::numeric, 2) as avg_sentiment,
    MAX(calculated_at) as last_updated,
    COUNT(DISTINCT source_type) as source_count,
    ROUND(
      (AVG(weighted_velocity) * MAX(recency_score) * (1 + (COUNT(DISTINCT source_type) - 1) * 0.3))::numeric, 
      1
    ) as unified_score
  FROM all_trends
  GROUP BY normalized_name
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY unified_score DESC) as id,
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
  unified_score,
  CASE 
    WHEN total_mentions_24h >= 5 AND source_count >= 2 THEN true
    WHEN unified_score >= 200 THEN true
    ELSE false
  END as is_breakthrough,
  NOW() as refreshed_at
FROM aggregated
WHERE unified_score > 0
ORDER BY unified_score DESC;

-- Create indexes
CREATE INDEX idx_mv_unified_trends_score ON public.mv_unified_trends (unified_score DESC);
CREATE INDEX idx_mv_unified_trends_breakthrough ON public.mv_unified_trends (is_breakthrough) WHERE is_breakthrough = true;

-- Function to refresh
CREATE OR REPLACE FUNCTION public.refresh_unified_trends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.mv_unified_trends;
END;
$$;
