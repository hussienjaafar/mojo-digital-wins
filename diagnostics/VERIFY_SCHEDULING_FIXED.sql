-- =============================================================================
-- VERIFY SCHEDULING IS NOW WORKING
-- Run this 5-10 minutes after running POPULATE_SCHEDULED_JOBS.sql
-- =============================================================================

-- 1. CHECK SCHEDULED JOBS TABLE
SELECT
  '1. SCHEDULED JOBS' AS section,
  job_name,
  is_active,
  last_run_status,
  last_run_at,
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) / 60 AS minutes_since_last_run,
  consecutive_failures,
  next_run_at
FROM scheduled_jobs
ORDER BY last_run_at DESC NULLS LAST;

-- 2. CHECK RECENT JOB EXECUTIONS
SELECT
  '2. RECENT EXECUTIONS' AS section,
  j.job_name,
  e.status,
  e.started_at,
  e.completed_at,
  e.duration_ms,
  e.items_processed,
  e.items_created,
  LEFT(e.error_message, 100) AS error_summary
FROM job_executions e
JOIN scheduled_jobs j ON e.job_id = j.id
ORDER BY e.started_at DESC
LIMIT 20;

-- 3. CHECK DAILY BRIEFINGS
SELECT
  '3. DAILY BRIEFINGS' AS section,
  briefing_date,
  created_at,
  critical_count,
  high_count,
  medium_count,
  total_articles,
  total_bills,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_since_creation
FROM daily_briefings
ORDER BY created_at DESC
LIMIT 5;

-- 4. CHECK PG_CRON JOBS
SELECT
  '4. PG_CRON JOBS' AS section,
  jobname,
  schedule,
  active,
  database
FROM cron.job
ORDER BY jobid;

-- 5. CHECK RECENT PG_CRON RUNS
SELECT
  '5. PG_CRON RUNS' AS section,
  j.jobname,
  r.status,
  r.start_time,
  LEFT(r.return_message, 100) AS message_summary
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE r.start_time > NOW() - INTERVAL '30 minutes'
ORDER BY r.start_time DESC
LIMIT 10;

-- 6. OVERALL HEALTH CHECK
DO $$
DECLARE
  active_jobs INTEGER;
  recent_runs INTEGER;
  recent_briefings INTEGER;
  status TEXT;
BEGIN
  SELECT COUNT(*) INTO active_jobs FROM scheduled_jobs WHERE is_active = true;
  SELECT COUNT(*) INTO recent_runs FROM job_executions WHERE started_at > NOW() - INTERVAL '30 minutes';
  SELECT COUNT(*) INTO recent_briefings FROM daily_briefings WHERE created_at > NOW() - INTERVAL '2 hours';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '6. OVERALL HEALTH CHECK';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Active jobs: %', active_jobs;
  RAISE NOTICE 'Recent executions (30 min): %', recent_runs;
  RAISE NOTICE 'Recent briefings (2 hours): %', recent_briefings;
  RAISE NOTICE '';

  IF active_jobs > 0 AND recent_runs > 0 THEN
    status := '✅ HEALTHY - Scheduling is working!';
  ELSIF active_jobs > 0 AND recent_runs = 0 THEN
    status := '🟡 WAITING - Jobs active but no executions yet (wait 5 more min)';
  ELSE
    status := '🔴 PROBLEM - Check logs above';
  END IF;

  RAISE NOTICE 'Status: %', status;
  RAISE NOTICE '';

  IF recent_briefings > 0 THEN
    RAISE NOTICE '✅ Daily briefings are generating!';
  ELSE
    RAISE NOTICE '⏳ No recent briefings yet (may take 30 min)';
  END IF;
  RAISE NOTICE '';
END $$;
