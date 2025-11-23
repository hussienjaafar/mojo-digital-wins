-- =============================================================================
-- POPULATE SCHEDULED_JOBS TABLE
-- Fix for: scheduled_jobs table was empty, causing daily briefings not to run
-- Root Cause: Previous migration INSERT statements never executed
-- =============================================================================

-- Ensure table structure is correct (should already exist from 20251118000003)
-- Adding safety check in case of migration order issues
DO $$
BEGIN
  -- Add missing columns if they don't exist (from later migrations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_jobs' AND column_name = 'consecutive_failures'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_jobs' AND column_name = 'last_run_duration_ms'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN last_run_duration_ms INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_jobs' AND column_name = 'last_run_status'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN last_run_status TEXT;
  END IF;
END $$;

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

  -- SMART ALERTING (Every 30 minutes) - CRITICAL FOR DAILY BRIEFINGS
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
      WHEN EXTRACT(HOUR FROM NOW()) >= 8 THEN
        (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '8 hours')
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
-- LOG SUCCESS
-- =============================================================================

DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count FROM public.scheduled_jobs WHERE is_active = true;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SCHEDULED JOBS POPULATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total active jobs: %', job_count;
  RAISE NOTICE 'Smart Alerting: ENABLED';
  RAISE NOTICE 'Daily briefings will auto-generate every 30 minutes';
  RAISE NOTICE '';
END $$;
