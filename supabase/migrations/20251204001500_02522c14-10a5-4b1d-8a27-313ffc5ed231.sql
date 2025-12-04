
-- Fix the baseline calculation function to handle case variations properly
CREATE OR REPLACE FUNCTION public.calculate_topic_baselines()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  topics_updated INTEGER := 0;
BEGIN
  -- First aggregate by normalized name to avoid duplicates
  WITH topic_stats AS (
    SELECT 
      MIN(topic) as topic_name,  -- Pick one representative name
      LOWER(TRIM(topic)) as normalized,
      ROUND(COUNT(*)::NUMERIC / 7, 2) as avg_daily,
      ROUND(COUNT(*)::NUMERIC / (7 * 24), 2) as avg_hourly,
      COUNT(*) as total_mentions,
      COUNT(DISTINCT DATE(created_at)) as data_points
    FROM (
      SELECT 
        unnest(ai_topics) as topic,
        created_at
      FROM public.bluesky_posts
      WHERE ai_processed = true
        AND created_at >= NOW() - INTERVAL '7 days'
    ) subq
    WHERE topic IS NOT NULL
      AND LENGTH(topic) > 2
      AND topic ~ '^[A-Z]'
      AND LOWER(topic) NOT IN (SELECT LOWER(topic) FROM public.evergreen_topics)
    GROUP BY LOWER(TRIM(topic))
    HAVING COUNT(*) >= 3
  )
  INSERT INTO public.topic_baselines (topic_name, normalized_name, avg_daily_mentions, avg_hourly_mentions, peak_mentions_24h, data_points, baseline_calculated_at, updated_at)
  SELECT 
    topic_name,
    normalized,
    avg_daily,
    avg_hourly,
    total_mentions::INTEGER,
    data_points,
    NOW(),
    NOW()
  FROM topic_stats
  ON CONFLICT (normalized_name) DO UPDATE SET
    avg_daily_mentions = EXCLUDED.avg_daily_mentions,
    avg_hourly_mentions = EXCLUDED.avg_hourly_mentions,
    peak_mentions_24h = EXCLUDED.peak_mentions_24h,
    data_points = EXCLUDED.data_points,
    baseline_calculated_at = NOW(),
    updated_at = NOW();
  
  GET DIAGNOSTICS topics_updated = ROW_COUNT;
  RETURN topics_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_topic_baselines() TO service_role;
