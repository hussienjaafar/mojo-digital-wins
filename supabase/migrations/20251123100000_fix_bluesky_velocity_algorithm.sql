-- Fix Bluesky Velocity Algorithm
-- Critical fix for Sprint 0: All velocities showing 0% due to incorrect array queries

-- =============================================================================
-- 1. CREATE HELPER FUNCTION FOR TOPIC COUNTING
-- =============================================================================

-- Function to count posts containing a specific topic
CREATE OR REPLACE FUNCTION count_posts_with_topic(
  topic_name TEXT,
  time_window INTERVAL DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  post_count BIGINT;
BEGIN
  IF time_window IS NULL THEN
    -- Count all posts with this topic
    SELECT COUNT(*) INTO post_count
    FROM bluesky_posts
    WHERE topic_name = ANY(ai_topics)
    AND ai_processed = true;
  ELSE
    -- Count posts within time window
    SELECT COUNT(*) INTO post_count
    FROM bluesky_posts
    WHERE topic_name = ANY(ai_topics)
    AND ai_processed = true
    AND created_at >= (now() - time_window);
  END IF;

  RETURN COALESCE(post_count, 0);
END;
$$;

-- =============================================================================
-- 2. CREATE VELOCITY CALCULATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_topic_velocity(
  topic_name TEXT,
  hourly_count BIGINT,
  six_hour_count BIGINT,
  daily_count BIGINT
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  six_hour_avg NUMERIC;
  daily_avg NUMERIC;
  velocity NUMERIC;
BEGIN
  -- Calculate averages
  six_hour_avg := six_hour_count::NUMERIC / 6;
  daily_avg := daily_count::NUMERIC / 24;

  -- Calculate velocity (how much faster than baseline)
  IF daily_avg > 0 THEN
    velocity := ((six_hour_avg - daily_avg) / daily_avg) * 100;
  ELSIF six_hour_count > 0 THEN
    -- New topic emerging = high velocity
    velocity := 500;
  ELSE
    velocity := 0;
  END IF;

  RETURN ROUND(velocity, 2);
END;
$$;

-- =============================================================================
-- 3. CREATE BATCH TREND UPDATE FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_bluesky_trends()
RETURNS TABLE(
  topic TEXT,
  velocity NUMERIC,
  is_trending BOOLEAN,
  mentions_24h BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  topic_record RECORD;
BEGIN
  -- Get all unique topics from recent posts (last 7 days for efficiency)
  FOR topic_record IN
    SELECT DISTINCT unnest(ai_topics) as topic_name
    FROM bluesky_posts
    WHERE ai_processed = true
    AND created_at >= (now() - interval '7 days')
  LOOP
    DECLARE
      hourly_count BIGINT;
      six_hour_count BIGINT;
      daily_count BIGINT;
      weekly_count BIGINT;
      topic_velocity NUMERIC;
      topic_is_trending BOOLEAN;
      avg_sentiment NUMERIC;
      positive_count INTEGER;
      neutral_count INTEGER;
      negative_count INTEGER;
    BEGIN
      -- Count mentions in different time windows
      hourly_count := count_posts_with_topic(topic_record.topic_name, interval '1 hour');
      six_hour_count := count_posts_with_topic(topic_record.topic_name, interval '6 hours');
      daily_count := count_posts_with_topic(topic_record.topic_name, interval '24 hours');
      weekly_count := count_posts_with_topic(topic_record.topic_name, interval '7 days');

      -- Calculate velocity
      topic_velocity := calculate_topic_velocity(
        topic_record.topic_name,
        hourly_count,
        six_hour_count,
        daily_count
      );

      -- Determine if trending (velocity > 50% and minimum volume)
      topic_is_trending := (topic_velocity > 50 AND daily_count >= 3) OR six_hour_count >= 5;

      -- Calculate sentiment breakdown
      SELECT
        AVG(ai_sentiment),
        COUNT(*) FILTER (WHERE ai_sentiment > 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment >= -0.3 AND ai_sentiment <= 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment < -0.3)
      INTO avg_sentiment, positive_count, neutral_count, negative_count
      FROM bluesky_posts
      WHERE topic_record.topic_name = ANY(ai_topics)
      AND ai_processed = true
      AND created_at >= (now() - interval '24 hours');

      -- Upsert to trends table
      INSERT INTO bluesky_trends (
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
        topic_record.topic_name,
        hourly_count,
        six_hour_count,
        daily_count,
        weekly_count,
        topic_velocity,
        COALESCE(avg_sentiment, 0),
        COALESCE(positive_count, 0),
        COALESCE(neutral_count, 0),
        COALESCE(negative_count, 0),
        topic_is_trending,
        CASE WHEN topic_is_trending THEN now() ELSE NULL END,
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
          WHEN EXCLUDED.is_trending AND NOT bluesky_trends.is_trending
          THEN now()
          ELSE bluesky_trends.trending_since
        END,
        last_seen_at = now(),
        calculated_at = now(),
        updated_at = now();

      -- Return result
      RETURN QUERY SELECT
        topic_record.topic_name,
        topic_velocity,
        topic_is_trending,
        daily_count;
    END;
  END LOOP;
END;
$$;

-- =============================================================================
-- 4. ADD UNIQUE CONSTRAINT TO TRENDS TABLE
-- =============================================================================

-- Add unique constraint on topic if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bluesky_trends_topic_unique'
  ) THEN
    ALTER TABLE bluesky_trends
    ADD CONSTRAINT bluesky_trends_topic_unique UNIQUE (topic);
  END IF;
END $$;

-- =============================================================================
-- 5. CREATE SCHEDULED JOB TO UPDATE TRENDS
-- =============================================================================

-- Create a pg_cron job to update trends every 10 minutes
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('update-bluesky-trends');

    -- Schedule new job
    PERFORM cron.schedule(
      'update-bluesky-trends',
      '*/10 * * * *', -- Every 10 minutes
      $$SELECT update_bluesky_trends();$$
    );
  END IF;
END $$;

-- =============================================================================
-- 6. IMMEDIATE TREND UPDATE
-- =============================================================================

-- Run an immediate update to populate/fix existing trends
SELECT * FROM update_bluesky_trends();

-- =============================================================================
-- 7. ADD MONITORING VIEW
-- =============================================================================

CREATE OR REPLACE VIEW bluesky_trending_topics AS
SELECT
  topic,
  velocity,
  mentions_last_hour as "1h",
  mentions_last_6_hours as "6h",
  mentions_last_24_hours as "24h",
  sentiment_avg,
  CASE
    WHEN is_trending THEN '🔥 TRENDING'
    ELSE ''
  END as status,
  calculated_at
FROM bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY
  is_trending DESC,
  velocity DESC,
  mentions_last_24_hours DESC
LIMIT 20;

-- Example query to see trending topics:
-- SELECT * FROM bluesky_trending_topics;

-- =============================================================================
-- 8. PERFORMANCE METRICS
-- =============================================================================

-- Add metrics to track algorithm performance
CREATE TABLE IF NOT EXISTS bluesky_velocity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_time_ms INTEGER,
  topics_processed INTEGER,
  trending_detected INTEGER,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for metrics
CREATE INDEX idx_velocity_metrics_created ON bluesky_velocity_metrics(created_at DESC);

COMMENT ON FUNCTION count_posts_with_topic IS 'Counts Bluesky posts containing a specific topic within an optional time window';
COMMENT ON FUNCTION calculate_topic_velocity IS 'Calculates trending velocity based on mention rates across different time windows';
COMMENT ON FUNCTION update_bluesky_trends IS 'Updates all trending topics with proper velocity calculations';
COMMENT ON VIEW bluesky_trending_topics IS 'Real-time view of trending Bluesky topics with velocity metrics';