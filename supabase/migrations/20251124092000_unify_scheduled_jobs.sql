-- Unify scheduled_jobs schema and provide a compatibility view
DO $$
BEGIN
  -- Ensure columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_jobs' AND column_name='schedule'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN schedule TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='scheduled_jobs' AND column_name='is_active'
  ) THEN
    ALTER TABLE scheduled_jobs ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Backfill schedule from legacy cron_expression when missing
  UPDATE scheduled_jobs SET schedule = COALESCE(schedule, cron_expression);
  UPDATE scheduled_jobs SET is_active = COALESCE(is_active, is_enabled, true);
END $$;

-- Create a compatibility view exposing unified columns for older queries
DROP VIEW IF EXISTS scheduled_jobs_compat;
CREATE VIEW scheduled_jobs_compat AS
SELECT
  id,
  job_name,
  job_type,
  COALESCE(schedule, cron_expression) AS schedule,
  COALESCE(is_active, is_enabled) AS is_active,
  description,
  last_run_at,
  last_run_status,
  last_run_duration_ms,
  last_error,
  next_run_at,
  run_count,
  failure_count,
  created_at,
  updated_at
FROM scheduled_jobs;
