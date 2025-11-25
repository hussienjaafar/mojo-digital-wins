-- Fix ambiguous column references in Bluesky velocity functions
-- Recreate helper and trend update functions with explicit aliases and parameter names

-- Helper: count posts containing a topic with optional time window
CREATE OR REPLACE FUNCTION public.count_posts_with_topic(
  p_topic TEXT,
  time_window INTERVAL DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  post_count BIGINT;
BEGIN
  IF time_window IS NULL THEN
    SELECT COUNT(*) INTO post_count
    FROM public.bluesky_posts bp
    WHERE p_topic = ANY(bp.ai_topics)
      AND bp.ai_processed = true;
  ELSE
    SELECT COUNT(*) INTO post_count
    FROM public.bluesky_posts bp
    WHERE p_topic = ANY(bp.ai_topics)
      AND bp.ai_processed = true
      AND bp.created_at >= (now() - time_window);
  END IF;

  RETURN COALESCE(post_count, 0);
END;
$$;

COMMENT ON FUNCTION public.count_posts_with_topic IS 'Counts Bluesky posts containing a specific topic within an optional time window';

-- Helper: calculate velocity based on counts
CREATE OR REPLACE FUNCTION public.calculate_topic_velocity(
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
  six_hour_avg := six_hour_count::NUMERIC / 6;
  daily_avg := daily_count::NUMERIC / 24;

  IF daily_avg > 0 THEN
    velocity := ((six_hour_avg - daily_avg) / daily_avg) * 100;
  ELSIF six_hour_count > 0 THEN
    velocity := 500;
  ELSE
    velocity := 0;
  END IF;

  RETURN ROUND(velocity, 2);
END;
$$;

COMMENT ON FUNCTION public.calculate_topic_velocity IS 'Calculates trending velocity based on mention rates across time windows';

-- Main: update trends with explicit aliases and spike metadata
CREATE OR REPLACE FUNCTION public.update_bluesky_trends()
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
  FOR topic_record IN
    SELECT DISTINCT unnest(bp.ai_topics) AS topic_name
    FROM public.bluesky_posts bp
    WHERE bp.ai_processed = true
      AND bp.created_at >= (now() - interval '7 days')
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
      baseline_velocity NUMERIC;
      spike_detected BOOLEAN;
      spike_magnitude NUMERIC;
    BEGIN
      hourly_count := public.count_posts_with_topic(topic_record.topic_name, interval '1 hour');
      six_hour_count := public.count_posts_with_topic(topic_record.topic_name, interval '6 hours');
      daily_count := public.count_posts_with_topic(topic_record.topic_name, interval '24 hours');
      weekly_count := public.count_posts_with_topic(topic_record.topic_name, interval '7 days');

      topic_velocity := public.calculate_topic_velocity(
        hourly_count,
        six_hour_count,
        daily_count
      );

      topic_is_trending := (topic_velocity > 50 AND daily_count >= 3) OR six_hour_count >= 5;

      baseline_velocity := (daily_count::NUMERIC / 24); -- daily avg per hour
      spike_detected := topic_is_trending;
      spike_magnitude := topic_velocity;

      SELECT
        AVG(bp.ai_sentiment),
        COUNT(*) FILTER (WHERE bp.ai_sentiment > 0.3),
        COUNT(*) FILTER (WHERE bp.ai_sentiment >= -0.3 AND bp.ai_sentiment <= 0.3),
        COUNT(*) FILTER (WHERE bp.ai_sentiment < -0.3)
      INTO avg_sentiment, positive_count, neutral_count, negative_count
      FROM public.bluesky_posts bp
      WHERE topic_record.topic_name = ANY(bp.ai_topics)
        AND bp.ai_processed = true
        AND bp.created_at >= (now() - interval '24 hours');

      INSERT INTO public.bluesky_trends (
        topic,
        mentions_last_hour,
        mentions_last_6_hours,
        mentions_last_24_hours,
        mentions_last_week,
        velocity,
        baseline_velocity,
        spike_detected,
        spike_magnitude,
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
        baseline_velocity,
        spike_detected,
        spike_magnitude,
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
        baseline_velocity = EXCLUDED.baseline_velocity,
        spike_detected = EXCLUDED.spike_detected,
        spike_magnitude = EXCLUDED.spike_magnitude,
        sentiment_avg = EXCLUDED.sentiment_avg,
        sentiment_positive = EXCLUDED.sentiment_positive,
        sentiment_neutral = EXCLUDED.sentiment_neutral,
        sentiment_negative = EXCLUDED.sentiment_negative,
        is_trending = EXCLUDED.is_trending,
        trending_since = CASE
          WHEN EXCLUDED.is_trending AND NOT public.bluesky_trends.is_trending
            THEN now()
          ELSE public.bluesky_trends.trending_since
        END,
        last_seen_at = now(),
        calculated_at = now(),
        updated_at = now();

      RETURN QUERY SELECT
        topic_record.topic_name,
        topic_velocity,
        topic_is_trending,
        daily_count;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.update_bluesky_trends IS 'Updates all trending topics with velocity, baseline, and spike metadata using explicit aliases to avoid ambiguity errors';
