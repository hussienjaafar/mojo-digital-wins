-- =============================================================================
-- QUICK CHECK: Verify Direct pg_cron Jobs Are Created
-- Run this 5 minutes after deployment to confirm the fix worked
-- =============================================================================

-- 1. CHECK PG_CRON JOBS (Should show smart-alerting jobs)
SELECT
  '1. PG_CRON JOBS' AS section,
  jobname,
  schedule,
  active,
  CASE
    WHEN jobname LIKE '%smart-alerting%' THEN '🎯 CRITICAL - Daily briefings'
    WHEN jobname LIKE '%daily-briefing%' THEN '📧 Email delivery'
    WHEN jobname LIKE '%trending%' THEN '📊 Analytics'
    WHEN jobname LIKE '%bluesky%' THEN '✅ Already working'
    ELSE '📌 Other'
  END AS importance
FROM cron.job
ORDER BY
  CASE
    WHEN jobname LIKE '%smart-alerting%' THEN 1
    WHEN jobname LIKE '%daily-briefing%' THEN 2
    WHEN jobname LIKE '%trending%' THEN 3
    ELSE 4
  END,
  jobname;

-- 2. CHECK RECENT CRON RUNS (Last 2 hours)
SELECT
  '2. RECENT CRON RUNS' AS section,
  j.jobname,
  r.status,
  r.start_time,
  r.end_time,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) AS duration_seconds,
  LEFT(r.return_message, 200) AS message
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE r.start_time > NOW() - INTERVAL '2 hours'
ORDER BY r.start_time DESC
LIMIT 30;

-- 3. CHECK DAILY BRIEFINGS (Has new one been created?)
SELECT
  '3. DAILY BRIEFINGS' AS section,
  briefing_date,
  created_at,
  critical_count,
  high_count,
  total_articles,
  total_bills,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) AS minutes_since_creation
FROM daily_briefings
ORDER BY created_at DESC
LIMIT 5;

-- 4. OVERALL STATUS
DO $$
DECLARE
  smart_alerting_jobs INTEGER;
  recent_smart_runs INTEGER;
  recent_briefings INTEGER;
  status TEXT;
BEGIN
  -- Count smart-alerting cron jobs
  SELECT COUNT(*) INTO smart_alerting_jobs
  FROM cron.job
  WHERE jobname LIKE '%smart-alerting%' AND active = true;

  -- Count recent smart-alerting runs
  SELECT COUNT(*) INTO recent_smart_runs
  FROM cron.job_run_details r
  JOIN cron.job j ON r.jobid = j.jobid
  WHERE j.jobname LIKE '%smart-alerting%'
    AND r.start_time > NOW() - INTERVAL '2 hours';

  -- Count recent briefings
  SELECT COUNT(*) INTO recent_briefings
  FROM daily_briefings
  WHERE created_at > NOW() - INTERVAL '2 hours';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '4. OVERALL STATUS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Smart Alerting cron jobs: %', smart_alerting_jobs;
  RAISE NOTICE 'Recent smart-alerting runs (2h): %', recent_smart_runs;
  RAISE NOTICE 'Recent daily briefings (2h): %', recent_briefings;
  RAISE NOTICE '';

  IF smart_alerting_jobs = 0 THEN
    status := '🔴 MIGRATION NOT DEPLOYED YET - Wait 5 more minutes';
  ELSIF smart_alerting_jobs > 0 AND recent_smart_runs = 0 THEN
    status := '🟡 JOBS CREATED - Waiting for first run (max 30 min)';
  ELSIF smart_alerting_jobs > 0 AND recent_smart_runs > 0 AND recent_briefings = 0 THEN
    status := '🟡 JOBS RUNNING - Briefing generation in progress';
  ELSIF recent_briefings > 0 THEN
    status := '✅ FULLY OPERATIONAL - Daily briefings generating!';
  ELSE
    status := '⏳ CHECK AGAIN IN 10 MINUTES';
  END IF;

  RAISE NOTICE 'Status: %', status;
  RAISE NOTICE '';

  IF smart_alerting_jobs > 0 THEN
    RAISE NOTICE '✅ Migration deployed successfully!';
    RAISE NOTICE '   Smart Alerting will run automatically every 30 minutes.';
  ELSE
    RAISE NOTICE '⏳ Migration still deploying. Check again in 5 minutes.';
  END IF;

  IF recent_briefings > 0 THEN
    RAISE NOTICE '✅ Daily briefings are generating!';
    RAISE NOTICE '   Platform is READY FOR BETA LAUNCH 🚀';
  ELSIF recent_smart_runs > 0 THEN
    RAISE NOTICE '🟡 Smart Alerting running but briefing not yet created.';
    RAISE NOTICE '   This is normal - may take 1-2 runs (60 minutes max).';
  END IF;
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================

-- AFTER 5-10 MINUTES (Migration deployed):
-- Section 1: Should show 3 new jobs:
--   - smart-alerting-every-30-min (active=true)
--   - daily-briefing-email-8am (active=true)
--   - extract-trending-topics-30min (active=true)

-- AFTER 30 MINUTES (First execution):
-- Section 2: Should show at least 1 run of smart-alerting
-- Section 3: Should show new daily briefing (created < 30 min ago)
-- Section 4: Status = "✅ FULLY OPERATIONAL"

-- AFTER 60 MINUTES (Confirmed working):
-- Section 2: Multiple smart-alerting runs
-- Section 3: Daily briefing with critical/high counts
-- Platform ready for beta launch! 🚀
