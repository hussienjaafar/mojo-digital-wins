-- =============================================================================
-- SCHEDULED JOB DIAGNOSTIC
-- Run this to find why daily briefings aren't auto-generating
-- =============================================================================

-- 1. CHECK IF SCHEDULED JOBS EXIST
SELECT
  job_name,
  job_type,
  cron_expression,
  is_active,
  last_run_at,
  next_run_at,
  run_count,
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) / 60 AS minutes_since_last_run
FROM scheduled_jobs
WHERE is_active = true
ORDER BY
  CASE WHEN last_run_at IS NULL THEN 1 ELSE 0 END,
  last_run_at DESC;

-- Expected: Should see jobs including:
-- - "Smart Alerting" (every 30 min)
-- - "Collect Bluesky Posts" (every 2 min)
-- - "Fetch RSS Feeds" (every 5 min)
-- - "Analyze Bluesky Posts" (every 10 min)
-- - "Extract Trending Topics" (every 30 min)


-- 2. CHECK PG_CRON CONFIGURATION
SELECT
  jobname,
  schedule,
  active,
  jobid
FROM cron.job
WHERE jobname LIKE '%scheduled%';

-- Expected: Should see "run-scheduled-jobs-every-minute" or similar


-- 3. CHECK RECENT CRON JOB RUNS
SELECT
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Expected: Recent runs with status = 'succeeded'


-- 4. MANUAL TEST: Try running smart-alerting directly
-- (This will be run via edge function call, not SQL)
-- We'll test this separately
