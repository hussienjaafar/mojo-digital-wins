-- =============================================================================
-- ADD DIRECT PG_CRON JOBS FOR SMART ALERTING & DAILY BRIEFINGS
-- Bypass the scheduled_jobs table issue by using direct pg_cron (like Bluesky)
-- =============================================================================
-- Since scheduled_jobs table population is failing, use the proven working
-- approach: direct pg_cron jobs that call edge functions directly

-- Remove any existing smart-alerting cron jobs to avoid duplicates
SELECT cron.unschedule('smart-alerting-every-30-min');
SELECT cron.unschedule('daily-briefing-email-8am');
SELECT cron.unschedule('extract-trending-topics-30min');

-- =============================================================================
-- SMART ALERTING (Every 30 minutes)
-- This is the CRITICAL job that generates daily briefings
-- =============================================================================
SELECT cron.schedule(
  'smart-alerting-every-30-min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/smart-alerting',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := jsonb_build_object('action', 'full')
  ) AS request_id;
  $$
);

-- =============================================================================
-- DAILY BRIEFING EMAIL (Daily at 8 AM)
-- Send email digest to subscribers
-- =============================================================================
SELECT cron.schedule(
  'daily-briefing-email-8am',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/send-daily-briefing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =============================================================================
-- EXTRACT TRENDING TOPICS (Every 30 minutes)
-- AI extraction of trending topics from news articles
-- =============================================================================
SELECT cron.schedule(
  'extract-trending-topics-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/extract-trending-topics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =============================================================================
-- VERIFY CRON JOBS WERE CREATED
-- =============================================================================
DO $$
DECLARE
  cron_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cron_count
  FROM cron.job
  WHERE jobname IN (
    'smart-alerting-every-30-min',
    'daily-briefing-email-8am',
    'extract-trending-topics-30min'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DIRECT PG_CRON JOBS CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Jobs created: %', cron_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Active jobs:';
  RAISE NOTICE '  - smart-alerting-every-30-min (every 30 min)';
  RAISE NOTICE '  - daily-briefing-email-8am (daily at 8 AM)';
  RAISE NOTICE '  - extract-trending-topics-30min (every 30 min)';
  RAISE NOTICE '';
  RAISE NOTICE 'Smart Alerting will run in max 30 minutes';
  RAISE NOTICE 'Daily briefing will generate automatically';
  RAISE NOTICE '========================================';
END $$;

-- Add comment explaining the architecture
COMMENT ON EXTENSION pg_cron IS
'Direct pg_cron jobs for critical automation:

ARCHITECTURE (Bypasses scheduled_jobs table):
- RSS Feed Sync: Via GitHub Actions (working)
- Bluesky Stream: Direct pg_cron (working)
- Analyze Bluesky: Direct pg_cron (working)
- Correlate Social/News: Direct pg_cron (working)
- Smart Alerting: Direct pg_cron (THIS MIGRATION) ← CRITICAL
- Daily Briefing Email: Direct pg_cron (THIS MIGRATION)
- Extract Trending Topics: Direct pg_cron (THIS MIGRATION)

This approach is proven working for Bluesky (217K posts collected).
No dependency on scheduled_jobs table or GitHub Actions.
More reliable, simpler architecture.';
