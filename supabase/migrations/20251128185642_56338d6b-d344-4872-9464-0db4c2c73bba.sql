
-- =============================================================================
-- DEEP AUDIT FIXES - Enable Realtime + Fix Database Function Security
-- =============================================================================

-- ============================================================================= 
-- PART 1: Enable Realtime on Critical Intelligence Tables
-- =============================================================================

-- Enable realtime for entity trends (trending topics detection)
ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_trends;

-- Enable realtime for client entity alerts (alert notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_entity_alerts;

-- Enable realtime for suggested actions (actionable intelligence)
ALTER PUBLICATION supabase_realtime ADD TABLE public.suggested_actions;

-- Enable realtime for entity mentions (live mention tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_mentions;

-- Enable realtime for fundraising opportunities
ALTER PUBLICATION supabase_realtime ADD TABLE public.fundraising_opportunities;

-- ============================================================================= 
-- PART 2: Fix Database Functions Security (Add search_path)
-- =============================================================================

-- Fix calculate_next_run
CREATE OR REPLACE FUNCTION public.calculate_next_run(cron_expr text, from_time timestamp with time zone DEFAULT now())
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expr TEXT := COALESCE(NULLIF(TRIM(cron_expr), ''), '*/10 * * * *');
  parts TEXT[];
  minute_part TEXT;
  hour_part TEXT;
BEGIN
  parts := string_to_array(expr, ' ');

  IF array_length(parts, 1) < 5 THEN
    RETURN from_time + interval '10 minutes';
  END IF;

  minute_part := parts[1];
  hour_part := parts[2];

  -- */N minute patterns
  IF minute_part LIKE '*/%' THEN
    RETURN from_time + (substring(minute_part from 3)::int * interval '1 minute');
  END IF;

  -- */N hour patterns
  IF hour_part LIKE '*/%' THEN
    RETURN from_time + (substring(hour_part from 3)::int * interval '1 hour');
  END IF;

  RETURN from_time + interval '10 minutes';
END;
$function$;

-- Fix calculate_topic_velocity
CREATE OR REPLACE FUNCTION public.calculate_topic_velocity(topic_name text, hourly_count bigint, six_hour_count bigint, daily_count bigint)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix count_posts_with_topic
CREATE OR REPLACE FUNCTION public.count_posts_with_topic(topic_name text, time_window interval DEFAULT NULL::interval)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_count BIGINT;
BEGIN
  IF time_window IS NULL THEN
    SELECT COUNT(*) INTO post_count
    FROM public.bluesky_posts
    WHERE topic_name = ANY(ai_topics)
    AND ai_processed = true;
  ELSE
    SELECT COUNT(*) INTO post_count
    FROM public.bluesky_posts
    WHERE topic_name = ANY(ai_topics)
    AND ai_processed = true
    AND created_at >= (now() - time_window);
  END IF;

  RETURN COALESCE(post_count, 0);
END;
$function$;

-- Fix get_backfill_progress
CREATE OR REPLACE FUNCTION public.get_backfill_progress()
RETURNS TABLE(task_name text, total_items bigint, processed_items bigint, completion_percentage numeric, posts_per_second numeric, estimated_hours_remaining numeric, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH current_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE ai_processed = false AND ai_relevance_score >= 0.1) as unprocessed,
      COUNT(*) FILTER (WHERE ai_processed = true) as processed_count
    FROM public.bluesky_posts
  )
  SELECT
    bs.task_name,
    cs.unprocessed + cs.processed_count as total,
    cs.processed_count,
    ROUND((cs.processed_count::NUMERIC / NULLIF(cs.unprocessed + cs.processed_count, 0)) * 100, 2) as pct,
    bs.posts_per_second,
    bs.estimated_hours_remaining,
    bs.status
  FROM public.backfill_status bs
  CROSS JOIN current_stats cs
  WHERE bs.task_name = 'bluesky_posts_backfill';
END;
$function$;

-- Fix update_bluesky_trends
CREATE OR REPLACE FUNCTION public.update_bluesky_trends()
RETURNS TABLE(topic_name text, topic_velocity numeric, topic_is_trending boolean, mentions_24h bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  topic_rec RECORD;
BEGIN
  FOR topic_rec IN
    SELECT DISTINCT unnest(ai_topics) as tname
    FROM public.bluesky_posts
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
      hourly_count := public.count_posts_with_topic(topic_rec.tname, interval '1 hour');
      six_hour_count := public.count_posts_with_topic(topic_rec.tname, interval '6 hours');
      daily_count := public.count_posts_with_topic(topic_rec.tname, interval '24 hours');
      weekly_count := public.count_posts_with_topic(topic_rec.tname, interval '7 days');

      calc_velocity := public.calculate_topic_velocity(
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
      FROM public.bluesky_posts
      WHERE topic_rec.tname = ANY(ai_topics)
      AND ai_processed = true
      AND created_at >= (now() - interval '24 hours');

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
      RETURN NEXT;
    END;
  END LOOP;
END;
$function$;

-- Fix update_job_after_execution
CREATE OR REPLACE FUNCTION public.update_job_after_execution(p_job_id uuid, p_status text, p_duration_ms integer, p_error text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expr TEXT;
BEGIN
  SELECT COALESCE(schedule, '*/10 * * * *') INTO expr FROM public.scheduled_jobs WHERE id = p_job_id;

  UPDATE public.scheduled_jobs
  SET
    last_run_at = now(),
    last_run_status = p_status,
    last_run_duration_ms = p_duration_ms,
    last_error = p_error,
    consecutive_failures = CASE WHEN p_status = 'failed' THEN consecutive_failures + 1 ELSE 0 END,
    next_run_at = public.calculate_next_run(expr, now()),
    updated_at = now()
  WHERE id = p_job_id;
END;
$function$;