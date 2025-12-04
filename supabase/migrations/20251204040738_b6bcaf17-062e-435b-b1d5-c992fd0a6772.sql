
-- Drop and recreate the materialized view with proper deduplication
DROP MATERIALIZED VIEW IF EXISTS mv_unified_trends;

CREATE MATERIALIZED VIEW mv_unified_trends AS
WITH news_trends AS (
  SELECT 
    INITCAP(t.topic) as name,
    deduplicate_topic_name(t.topic) as normalized_name,
    t.mentions_last_hour as mentions_1h,
    t.mentions_last_6_hours as mentions_6h,
    t.mentions_last_24_hours as mentions_24h,
    COALESCE(t.velocity, 0) as velocity,
    t.sentiment_avg as sentiment,
    t.calculated_at as last_updated,
    'news' as source_type
  FROM trending_news_topics t
  WHERE t.topic IS NOT NULL
    AND length(t.topic) > 2
    AND NOT EXISTS (
      SELECT 1 FROM evergreen_topics e 
      WHERE lower(t.topic) = lower(e.topic)
    )
    AND t.mentions_last_24_hours >= 1
),
social_trends AS (
  SELECT
    INITCAP(bt.topic) as name,
    deduplicate_topic_name(bt.topic) as normalized_name,
    COALESCE(bt.mentions_last_hour, 0) as mentions_1h,
    COALESCE(bt.mentions_last_6_hours, 0) as mentions_6h,
    COALESCE(bt.mentions_last_24_hours, 0) as mentions_24h,
    COALESCE(bt.velocity, 0) as velocity,
    bt.sentiment_avg as sentiment,
    bt.calculated_at as last_updated,
    'social' as source_type
  FROM bluesky_trends bt
  WHERE bt.topic IS NOT NULL
    AND length(bt.topic) > 2
    AND NOT EXISTS (
      SELECT 1 FROM evergreen_topics e 
      WHERE lower(bt.topic) = lower(e.topic)
    )
    AND COALESCE(bt.mentions_last_24_hours, 0) >= 1
),
combined AS (
  SELECT * FROM news_trends
  UNION ALL
  SELECT * FROM social_trends
),
aggregated AS (
  SELECT
    (array_agg(name ORDER BY length(name) DESC))[1] as name,
    normalized_name,
    SUM(mentions_1h) as total_mentions_1h,
    SUM(mentions_6h) as total_mentions_6h,
    SUM(mentions_24h) as total_mentions_24h,
    MAX(velocity) as max_velocity,
    AVG(sentiment) as avg_sentiment,
    array_agg(DISTINCT source_type) as source_types,
    COUNT(DISTINCT source_type) as source_count,
    MAX(last_updated) as last_updated
  FROM combined
  GROUP BY normalized_name
),
with_spike AS (
  SELECT
    a.*,
    CASE 
      WHEN total_mentions_6h > 0 THEN 
        LEAST(5.0, GREATEST(1.0, 
          (total_mentions_1h::numeric / NULLIF(total_mentions_6h::numeric / 6, 0))
        ))
      WHEN total_mentions_24h > 0 THEN
        LEAST(5.0, GREATEST(1.0,
          (total_mentions_1h::numeric / NULLIF(total_mentions_24h::numeric / 24, 0))
        ))
      ELSE 1.0
    END as spike_ratio,
    CASE 
      WHEN total_mentions_6h > 0 THEN total_mentions_6h::numeric / 6
      WHEN total_mentions_24h > 0 THEN total_mentions_24h::numeric / 24
      ELSE 0
    END as baseline_hourly
  FROM aggregated a
)
SELECT
  name,
  normalized_name,
  total_mentions_1h,
  total_mentions_6h,
  total_mentions_24h as total_mentions_24h,
  LEAST(max_velocity, 500) as velocity,
  avg_sentiment,
  spike_ratio,
  baseline_hourly,
  (max_velocity >= 100 AND spike_ratio >= 2.0 AND total_mentions_1h >= 3) as is_breakthrough,
  source_types,
  source_count,
  last_updated,
  (
    total_mentions_1h * 10 +
    total_mentions_24h +
    LEAST(max_velocity, 500) * 0.5 +
    CASE WHEN source_count >= 2 THEN 50 ELSE 0 END +
    CASE WHEN spike_ratio >= 2 THEN spike_ratio * 20 ELSE 0 END
  ) as unified_score
FROM with_spike
WHERE total_mentions_24h >= 2
ORDER BY unified_score DESC;

CREATE UNIQUE INDEX idx_mv_unified_trends_norm ON mv_unified_trends(normalized_name);
