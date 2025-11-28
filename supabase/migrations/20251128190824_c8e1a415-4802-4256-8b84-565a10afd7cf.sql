-- ============================================
-- PHASE 3 AUDIT FIXES: Performance & Optimization
-- ============================================

-- Fix #1: Add critical indexes for trend calculations
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_ai_topics_gin 
ON bluesky_posts USING GIN (ai_topics);

CREATE INDEX IF NOT EXISTS idx_bluesky_posts_processed_created 
ON bluesky_posts (ai_processed, created_at DESC) 
WHERE ai_processed = true;

CREATE INDEX IF NOT EXISTS idx_entity_mentions_name_time 
ON entity_mentions (entity_name, mentioned_at DESC);

CREATE INDEX IF NOT EXISTS idx_spike_alerts_status 
ON spike_alerts (status, detected_at DESC) 
WHERE status = 'pending';

-- Fix #2: Optimize update_bluesky_trends function with batch processing
CREATE OR REPLACE FUNCTION public.update_bluesky_trends_optimized(batch_limit INT DEFAULT 50)
RETURNS TABLE(topic_name text, topic_velocity numeric, topic_is_trending boolean, mentions_24h bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  topic_rec RECORD;
  topics_processed INT := 0;
BEGIN
  -- Only process top trending topics (by recent volume) to prevent timeout
  FOR topic_rec IN
    SELECT DISTINCT unnest(ai_topics) as tname, COUNT(*) as recent_count
    FROM public.bluesky_posts
    WHERE ai_processed = true
    AND created_at >= (now() - interval '24 hours')
    GROUP BY tname
    ORDER BY recent_count DESC
    LIMIT batch_limit
  LOOP
    DECLARE
      hourly_count BIGINT;
      six_hour_count BIGINT;
      daily_count BIGINT;
      weekly_count BIGINT;
      calc_velocity NUMERIC;
      is_trend BOOLEAN;
      avg_sentiment NUMERIC;
      positive_count INTEGER;
      neutral_count INTEGER;
      negative_count INTEGER;
    BEGIN
      -- Use indexed queries for better performance
      SELECT 
        COUNT(*) FILTER (WHERE created_at >= now() - interval '1 hour'),
        COUNT(*) FILTER (WHERE created_at >= now() - interval '6 hours'),
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
        COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')
      INTO hourly_count, six_hour_count, daily_count, weekly_count
      FROM public.bluesky_posts
      WHERE topic_rec.tname = ANY(ai_topics)
      AND ai_processed = true
      AND created_at >= (now() - interval '7 days');

      calc_velocity := public.calculate_topic_velocity(
        topic_rec.tname,
        hourly_count,
        six_hour_count,
        daily_count
      );

      is_trend := (calc_velocity > 50 AND daily_count >= 3) OR six_hour_count >= 5;

      -- Get sentiment data from last 24h only
      SELECT
        AVG(ai_sentiment),
        COUNT(*) FILTER (WHERE ai_sentiment > 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment >= -0.3 AND ai_sentiment <= 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment < -0.3)
      INTO avg_sentiment, positive_count, neutral_count, negative_count
      FROM public.bluesky_posts
      WHERE topic_rec.tname = ANY(ai_topics)
      AND ai_processed = true
      AND created_at >= (now() - interval '24 hours');

      -- Upsert trend data
      INSERT INTO public.bluesky_trends (
        topic,
        mentions_last_hour,
        mentions_last_6_hours,
        mentions_last_24_hours,
        mentions_last_week,
        velocity,
        sentiment_avg,
        sentiment_positive,
        sentiment_neutral,
        sentiment_negative,
        is_trending,
        trending_since,
        last_seen_at,
        calculated_at,
        updated_at
      )
      VALUES (
        topic_rec.tname,
        hourly_count,
        six_hour_count,
        daily_count,
        weekly_count,
        calc_velocity,
        COALESCE(avg_sentiment, 0),
        COALESCE(positive_count, 0),
        COALESCE(neutral_count, 0),
        COALESCE(negative_count, 0),
        is_trend,
        CASE WHEN is_trend THEN now() ELSE NULL END,
        now(),
        now(),
        now()
      )
      ON CONFLICT (topic) DO UPDATE SET
        mentions_last_hour = EXCLUDED.mentions_last_hour,
        mentions_last_6_hours = EXCLUDED.mentions_last_6_hours,
        mentions_last_24_hours = EXCLUDED.mentions_last_24_hours,
        mentions_last_week = EXCLUDED.mentions_last_week,
        velocity = EXCLUDED.velocity,
        sentiment_avg = EXCLUDED.sentiment_avg,
        sentiment_positive = EXCLUDED.sentiment_positive,
        sentiment_neutral = EXCLUDED.sentiment_neutral,
        sentiment_negative = EXCLUDED.sentiment_negative,
        is_trending = EXCLUDED.is_trending,
        trending_since = CASE
          WHEN EXCLUDED.is_trending AND public.bluesky_trends.is_trending = false
          THEN now()
          ELSE public.bluesky_trends.trending_since
        END,
        last_seen_at = now(),
        calculated_at = now(),
        updated_at = now();

      topic_name := topic_rec.tname;
      topic_velocity := calc_velocity;
      topic_is_trending := is_trend;
      mentions_24h := daily_count;
      topics_processed := topics_processed + 1;
      RETURN NEXT;
    END;
  END LOOP;
  
  RAISE NOTICE 'Processed % topics', topics_processed;
END;
$$;

-- Fix #3: Update analyze-bluesky-posts to use optimized function
-- (This will be handled in the edge function code)

-- Fix #4: Update detect-spikes to set email notifications by default
-- (This will be handled in the edge function code)