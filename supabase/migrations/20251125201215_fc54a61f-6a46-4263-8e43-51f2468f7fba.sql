-- Fix ambiguous column reference in update_bluesky_trends()
-- Use distinct output column names to avoid conflicts with internal variables

CREATE OR REPLACE FUNCTION public.update_bluesky_trends()
RETURNS TABLE(
  topic_name TEXT,
  topic_velocity NUMERIC,
  topic_is_trending BOOLEAN,
  mentions_24h BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  topic_rec RECORD;
BEGIN
  FOR topic_rec IN
    SELECT DISTINCT unnest(ai_topics) as tname
    FROM bluesky_posts
    WHERE ai_processed = true
    AND created_at >= (now() - interval '7 days')
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
      hourly_count := count_posts_with_topic(topic_rec.tname, interval '1 hour');
      six_hour_count := count_posts_with_topic(topic_rec.tname, interval '6 hours');
      daily_count := count_posts_with_topic(topic_rec.tname, interval '24 hours');
      weekly_count := count_posts_with_topic(topic_rec.tname, interval '7 days');

      calc_velocity := calculate_topic_velocity(
        topic_rec.tname,
        hourly_count,
        six_hour_count,
        daily_count
      );

      is_trend := (calc_velocity > 50 AND daily_count >= 3) OR six_hour_count >= 5;

      SELECT
        AVG(ai_sentiment),
        COUNT(*) FILTER (WHERE ai_sentiment > 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment >= -0.3 AND ai_sentiment <= 0.3),
        COUNT(*) FILTER (WHERE ai_sentiment < -0.3)
      INTO avg_sentiment, positive_count, neutral_count, negative_count
      FROM bluesky_posts
      WHERE topic_rec.tname = ANY(ai_topics)
      AND ai_processed = true
      AND created_at >= (now() - interval '24 hours');

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
          WHEN EXCLUDED.is_trending AND bluesky_trends.is_trending = false
          THEN now()
          ELSE bluesky_trends.trending_since
        END,
        last_seen_at = now(),
        calculated_at = now(),
        updated_at = now();

      topic_name := topic_rec.tname;
      topic_velocity := calc_velocity;
      topic_is_trending := is_trend;
      mentions_24h := daily_count;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;