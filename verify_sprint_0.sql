-- ============================================================================
-- SPRINT 0 VERIFICATION SCRIPT
-- Run this to verify all critical fixes are working
-- ============================================================================

-- Clear the console for clean output
\echo ''
\echo '============================================'
\echo 'SPRINT 0: CRITICAL FIXES VERIFICATION'
\echo '============================================'
\echo ''

-- ============================================================================
-- 1. VELOCITY ALGORITHM CHECK
-- ============================================================================
\echo '📊 VELOCITY ALGORITHM STATUS'
\echo '----------------------------'

WITH velocity_check AS (
  SELECT
    COUNT(*) as total_topics,
    COUNT(*) FILTER (WHERE velocity > 0) as topics_with_velocity,
    COUNT(*) FILTER (WHERE is_trending = true) as trending_topics,
    MAX(velocity) as max_velocity,
    AVG(velocity) FILTER (WHERE velocity > 0) as avg_velocity
  FROM bluesky_trends
  WHERE mentions_last_24_hours > 0
)
SELECT
  CASE
    WHEN topics_with_velocity = 0 THEN '❌ BROKEN - All velocities are 0'
    WHEN topics_with_velocity < total_topics * 0.2 THEN '⚠️ PARTIAL - Only some velocities working'
    ELSE '✅ WORKING - Velocities calculating correctly'
  END as status,
  total_topics,
  topics_with_velocity,
  trending_topics,
  ROUND(max_velocity, 2) as max_velocity_pct,
  ROUND(avg_velocity, 2) as avg_velocity_pct
FROM velocity_check;

\echo ''
\echo 'Top 5 Trending Topics:'
SELECT
  topic,
  velocity || '%' as velocity,
  mentions_last_hour as "1h",
  mentions_last_6_hours as "6h",
  mentions_last_24_hours as "24h",
  CASE WHEN is_trending THEN '🔥' ELSE '' END as trending
FROM bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY velocity DESC
LIMIT 5;

-- ============================================================================
-- 2. BACKFILL PROGRESS CHECK
-- ============================================================================
\echo ''
\echo '📈 BACKFILL PROGRESS'
\echo '-------------------'

WITH backfill_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE ai_processed = false AND ai_relevance_score >= 0.1) as unprocessed,
    COUNT(*) FILTER (WHERE ai_processed = true) as processed,
    COUNT(*) FILTER (WHERE ai_processed = true AND ai_processed_at >= now() - interval '1 hour') as last_hour,
    COUNT(*) FILTER (WHERE ai_processed = true AND ai_processed_at >= now() - interval '15 minutes') as last_15min
  FROM bluesky_posts
)
SELECT
  processed || ' / ' || (processed + unprocessed) as progress,
  ROUND((processed::NUMERIC / NULLIF(processed + unprocessed, 0)) * 100, 2) || '%' as completion,
  unprocessed as remaining,
  last_hour as processed_last_hour,
  last_15min as processed_last_15min,
  ROUND(last_15min * 4::NUMERIC, 0) as est_per_hour,
  CASE
    WHEN last_15min = 0 THEN '⏸️ STOPPED'
    WHEN last_15min < 100 THEN '🐌 SLOW'
    WHEN last_15min < 500 THEN '⚡ NORMAL'
    ELSE '🚀 FAST'
  END as processing_status
FROM backfill_stats;

-- ============================================================================
-- 3. API PERFORMANCE CHECK
-- ============================================================================
\echo ''
\echo '🔌 API PERFORMANCE'
\echo '------------------'

WITH recent_metrics AS (
  SELECT
    AVG(topics_processed) as avg_topics,
    AVG(trending_detected) as avg_trending,
    SUM(error_count) as total_errors,
    COUNT(*) as metric_count
  FROM bluesky_velocity_metrics
  WHERE created_at >= now() - interval '1 hour'
)
SELECT
  CASE
    WHEN metric_count = 0 THEN '❌ NO DATA - Metrics not being recorded'
    WHEN total_errors > metric_count * 0.5 THEN '❌ HIGH ERRORS - Check logs'
    WHEN avg_topics < 10 THEN '⚠️ LOW THROUGHPUT'
    ELSE '✅ HEALTHY - Processing normally'
  END as api_status,
  ROUND(avg_topics, 1) as avg_topics_per_batch,
  ROUND(avg_trending, 1) as avg_trending_detected,
  total_errors as errors_last_hour,
  metric_count as batches_last_hour
FROM recent_metrics;

-- ============================================================================
-- 4. SCHEDULED JOBS CHECK
-- ============================================================================
\echo ''
\echo '⏰ SCHEDULED JOBS'
\echo '-----------------'

-- Check pg_cron jobs
SELECT
  jobname,
  schedule,
  CASE WHEN active THEN '✅ Active' ELSE '❌ Inactive' END as status,
  command
FROM cron.job
WHERE jobname IN (
  'update-bluesky-trends',
  'bluesky-backfill-processor',
  'analyze-bluesky-every-10-min'
)
ORDER BY jobname;

-- ============================================================================
-- 5. RECENT ERRORS CHECK
-- ============================================================================
\echo ''
\echo '⚠️ RECENT ERRORS (Last Hour)'
\echo '----------------------------'

SELECT
  function_name,
  COUNT(*) as error_count,
  MAX(created_at) as last_error,
  SUBSTRING(MAX(error_message), 1, 100) as latest_error
FROM job_failures
WHERE created_at >= now() - interval '1 hour'
GROUP BY function_name
ORDER BY error_count DESC
LIMIT 5;

-- ============================================================================
-- 6. OVERALL HEALTH SCORE
-- ============================================================================
\echo ''
\echo '🎯 OVERALL SPRINT 0 HEALTH'
\echo '--------------------------'

WITH health_scores AS (
  SELECT
    -- Velocity working (40 points)
    CASE
      WHEN EXISTS (SELECT 1 FROM bluesky_trends WHERE velocity > 0) THEN 40
      ELSE 0
    END as velocity_score,

    -- Backfill progress (30 points)
    CASE
      WHEN (SELECT completion_percentage FROM backfill_monitoring) > 80 THEN 30
      WHEN (SELECT completion_percentage FROM backfill_monitoring) > 50 THEN 20
      WHEN (SELECT completion_percentage FROM backfill_monitoring) > 20 THEN 10
      ELSE 0
    END as backfill_score,

    -- Processing active (20 points)
    CASE
      WHEN EXISTS (
        SELECT 1 FROM bluesky_posts
        WHERE ai_processed = true
        AND ai_processed_at >= now() - interval '15 minutes'
      ) THEN 20
      ELSE 0
    END as processing_score,

    -- No recent errors (10 points)
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM job_failures
        WHERE created_at >= now() - interval '1 hour'
      ) THEN 10
      ELSE 0
    END as error_score
)
SELECT
  velocity_score + backfill_score + processing_score + error_score as total_score,
  CASE
    WHEN velocity_score + backfill_score + processing_score + error_score >= 90 THEN '🎉 EXCELLENT - Sprint 0 Complete!'
    WHEN velocity_score + backfill_score + processing_score + error_score >= 70 THEN '✅ GOOD - Nearly Complete'
    WHEN velocity_score + backfill_score + processing_score + error_score >= 50 THEN '⚠️ PARTIAL - Some fixes working'
    ELSE '❌ CRITICAL - Major issues remain'
  END as status,
  '• Velocity: ' || velocity_score || '/40' as velocity_status,
  '• Backfill: ' || backfill_score || '/30' as backfill_status,
  '• Processing: ' || processing_score || '/20' as processing_status,
  '• Errors: ' || error_score || '/10' as error_status
FROM health_scores;

\echo ''
\echo '============================================'
\echo 'Run this script again to check progress'
\echo '============================================'
\echo ''

-- Quick summary for dashboard
CREATE OR REPLACE VIEW sprint_0_dashboard AS
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM bluesky_trends WHERE velocity > 0) as working_velocities,
    (SELECT completion_percentage FROM backfill_monitoring) as backfill_pct,
    (SELECT COUNT(*) FROM bluesky_posts WHERE ai_processed = true AND ai_processed_at >= now() - interval '1 hour') as posts_last_hour,
    (SELECT COUNT(*) FROM job_failures WHERE created_at >= now() - interval '1 hour') as recent_errors
)
SELECT
  working_velocities,
  backfill_pct || '%' as backfill_progress,
  posts_last_hour as processing_rate_per_hour,
  recent_errors,
  CASE
    WHEN working_velocities > 0 AND backfill_pct > 50 AND posts_last_hour > 100 THEN '✅ HEALTHY'
    WHEN working_velocities > 0 OR posts_last_hour > 0 THEN '⚠️ PARTIAL'
    ELSE '❌ CRITICAL'
  END as overall_status
FROM stats;