-- =============================================================================
-- CHECK WHAT JOBS ARE IN THE SCHEDULED_JOBS TABLE
-- =============================================================================
-- This will show us which jobs are configured and their current status

SELECT
  job_name,
  job_type,
  schedule,
  is_active,
  last_run_at,
  next_run_at,
  last_run_status,
  last_error,
  EXTRACT(EPOCH FROM (NOW() - last_run_at)) / 60 AS minutes_since_last_run,
  consecutive_failures
FROM scheduled_jobs
ORDER BY
  is_active DESC,
  CASE WHEN last_run_at IS NULL THEN 1 ELSE 0 END,
  last_run_at DESC;

-- =============================================================================
-- CHECK WHAT PG_CRON JOBS ARE ACTIVE
-- =============================================================================
SELECT
  jobname,
  schedule,
  active,
  jobid,
  database
FROM cron.job
ORDER BY jobid;

-- =============================================================================
-- CHECK RECENT PG_CRON JOB RUNS
-- =============================================================================
SELECT
  j.jobname,
  r.status,
  r.return_message,
  r.start_time,
  r.end_time,
  EXTRACT(EPOCH FROM (r.end_time - r.start_time)) AS duration_seconds
FROM cron.job_run_details r
JOIN cron.job j ON r.jobid = j.jobid
WHERE r.start_time > NOW() - INTERVAL '1 hour'
ORDER BY r.start_time DESC
LIMIT 20;
