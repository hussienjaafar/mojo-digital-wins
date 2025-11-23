-- =============================================================================
-- POPULATE SCHEDULED_JOBS TABLE
-- Fix for: "Table is empty - no jobs exist at all"
-- =============================================================================
-- This creates all the necessary scheduled jobs for automated data processing

-- First, ensure the table exists and has the right structure
-- (Migration 20251118000003 should have created it, but let's be safe)
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,  -- Updated column name from cron_expression
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  last_run_duration_ms INTEGER,
  last_error TEXT,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INSERT ALL SCHEDULED JOBS
-- =============================================================================

INSERT INTO public.scheduled_jobs (
  job_name,
  job_type,
  description,
  schedule,
  is_active,
  next_run_at
) VALUES

  -- RSS FEED SYNC (Every 5 minutes)
  (
    'RSS Feed Sync',
    'fetch_rss',
    'Fetch articles from 140+ configured RSS feeds using parallel batch processing',
    '*/5 * * * *',
    true,
    NOW() + INTERVAL '5 minutes'
  ),

  -- SMART ALERTING (Every 30 minutes)
  (
    'Smart Alerting',
    'smart_alerting',
    'Detect breaking news, cluster multi-source stories, generate daily briefings',
    '*/30 * * * *',
    true,
    NOW() + INTERVAL '5 minutes'  -- Run immediately for testing
  ),

  -- DAILY BRIEFING EMAIL (Daily at 8 AM)
  (
    'Daily Briefing Email',
    'send_briefings',
    'Send daily briefing emails to all subscribers with email_preferences enabled',
    '0 8 * * *',
    true,
    CASE
      -- If it's already past 8 AM today, schedule for tomorrow 8 AM
      WHEN EXTRACT(HOUR FROM NOW()) >= 8 THEN
        (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '8 hours')
      -- If it's before 8 AM, schedule for today 8 AM
      ELSE
        (CURRENT_DATE + INTERVAL '8 hours')
    END
  ),

  -- EXECUTIVE ORDERS SYNC (Every 6 hours)
  (
    'Executive Orders Sync',
    'fetch_executive_orders',
    'Fetch federal executive orders from Federal Register API',
    '0 */6 * * *',
    true,
    NOW() + INTERVAL '6 hours'
  ),

  -- STATE ACTIONS SYNC (Every 6 hours)
  (
    'State Actions Sync',
    'track_state_actions',
    'Track state-level government actions (laws, executive orders, regulations)',
    '0 */6 * * *',
    true,
    NOW() + INTERVAL '6 hours'
  ),

  -- ANALYZE BLUESKY POSTS (Every 10 minutes)
  (
    'Analyze Bluesky Posts',
    'analyze_bluesky',
    'AI-powered topic extraction and sentiment analysis of Bluesky social posts',
    '*/10 * * * *',
    true,
    NOW() + INTERVAL '10 minutes'
  ),

  -- CORRELATE SOCIAL & NEWS (Every 15 minutes)
  (
    'Correlate Social & News',
    'correlate_social_news',
    'Match Bluesky social trends with news articles to detect predictive signals',
    '*/15 * * * *',
    true,
    NOW() + INTERVAL '15 minutes'
  ),

  -- COLLECT BLUESKY POSTS (Every 2 minutes)
  (
    'Collect Bluesky Posts',
    'collect_bluesky',
    'Poll JetStream firehose with cursor-based resumption (runs 30s, collects ~10K posts)',
    '*/2 * * * *',
    true,
    NOW() + INTERVAL '2 minutes'
  ),

  -- EXTRACT TRENDING TOPICS (Every 30 minutes)
  (
    'Extract Trending Topics',
    'extract_trending_topics',
    'AI extraction of trending topics from recent news articles',
    '*/30 * * * *',
    true,
    NOW() + INTERVAL '30 minutes'
  )

ON CONFLICT (job_name) DO UPDATE SET
  job_type = EXCLUDED.job_type,
  description = EXCLUDED.description,
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  next_run_at = EXCLUDED.next_run_at,
  updated_at = NOW();

-- =============================================================================
-- VERIFY JOBS WERE CREATED
-- =============================================================================

SELECT
  job_name,
  job_type,
  schedule,
  is_active,
  next_run_at,
  EXTRACT(EPOCH FROM (next_run_at - NOW())) / 60 AS minutes_until_next_run
FROM public.scheduled_jobs
ORDER BY next_run_at;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count FROM public.scheduled_jobs WHERE is_active = true;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SCHEDULED JOBS CREATED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total active jobs: %', job_count;
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. GitHub Actions will run in max 5 minutes';
  RAISE NOTICE '2. Smart Alerting will execute';
  RAISE NOTICE '3. Daily briefing should generate within 5-10 minutes';
  RAISE NOTICE '4. Check daily_briefings table to confirm';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitor execution:';
  RAISE NOTICE '  SELECT * FROM job_executions ORDER BY started_at DESC LIMIT 10;';
  RAISE NOTICE '';
END $$;
