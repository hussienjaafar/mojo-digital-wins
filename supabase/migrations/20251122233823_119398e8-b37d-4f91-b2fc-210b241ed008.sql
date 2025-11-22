-- Phase 1: Fix Scheduled Jobs System

-- Create function to calculate next run time from cron expression
CREATE OR REPLACE FUNCTION calculate_next_run(cron_schedule TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_run TIMESTAMPTZ;
BEGIN
  -- Simple cron parsing for common patterns
  CASE 
    WHEN cron_schedule = '*/2 * * * *' THEN
      next_run := NOW() + INTERVAL '2 minutes';
    WHEN cron_schedule = '*/5 * * * *' THEN
      next_run := NOW() + INTERVAL '5 minutes';
    WHEN cron_schedule = '*/10 * * * *' THEN
      next_run := NOW() + INTERVAL '10 minutes';
    WHEN cron_schedule = '*/15 * * * *' THEN
      next_run := NOW() + INTERVAL '15 minutes';
    WHEN cron_schedule = '*/30 * * * *' THEN
      next_run := NOW() + INTERVAL '30 minutes';
    WHEN cron_schedule = '0 * * * *' THEN
      -- Every hour on the hour
      next_run := DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour';
    WHEN cron_schedule = '0 */6 * * *' THEN
      -- Every 6 hours
      next_run := DATE_TRUNC('hour', NOW()) + INTERVAL '6 hours';
    WHEN cron_schedule = '0 */8 * * *' THEN
      -- Every 8 hours
      next_run := DATE_TRUNC('hour', NOW()) + INTERVAL '8 hours';
    WHEN cron_schedule = '0 2 * * *' THEN
      -- Daily at 2 AM
      IF EXTRACT(HOUR FROM NOW()) >= 2 THEN
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + INTERVAL '2 hours';
      ELSE
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '2 hours';
      END IF;
    WHEN cron_schedule = '0 7 * * *' THEN
      -- Daily at 7 AM
      IF EXTRACT(HOUR FROM NOW()) >= 7 THEN
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '1 day' + INTERVAL '7 hours';
      ELSE
        next_run := DATE_TRUNC('day', NOW()) + INTERVAL '7 hours';
      END IF;
    ELSE
      -- Default: 1 hour from now
      next_run := NOW() + INTERVAL '1 hour';
  END CASE;
  
  RETURN next_run;
END;
$$ LANGUAGE plpgsql;

-- Create function to update job after execution
CREATE OR REPLACE FUNCTION update_job_after_execution(
  p_job_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_error TEXT
)
RETURNS VOID AS $$
DECLARE
  v_schedule TEXT;
  v_next_run TIMESTAMPTZ;
  v_consecutive_failures INTEGER;
BEGIN
  -- Get current job info
  SELECT schedule, consecutive_failures
  INTO v_schedule, v_consecutive_failures
  FROM scheduled_jobs
  WHERE id = p_job_id;
  
  -- Calculate next run time
  v_next_run := calculate_next_run(v_schedule);
  
  -- Update job record
  UPDATE scheduled_jobs
  SET 
    last_run_at = NOW(),
    last_run_status = p_status,
    last_run_duration_ms = p_duration_ms,
    last_error = p_error,
    next_run_at = v_next_run,
    consecutive_failures = CASE 
      WHEN p_status = 'success' THEN 0
      ELSE COALESCE(v_consecutive_failures, 0) + 1
    END,
    -- Auto-disable after 5 consecutive failures
    is_active = CASE
      WHEN p_status = 'failed' AND COALESCE(v_consecutive_failures, 0) >= 4 THEN false
      ELSE is_active
    END,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Log if auto-disabled
  IF p_status = 'failed' AND COALESCE(v_consecutive_failures, 0) >= 4 THEN
    RAISE NOTICE 'Job % auto-disabled after 5 consecutive failures', p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add missing columns to job_executions
ALTER TABLE job_executions 
ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS execution_log JSONB;

-- Add missing columns to scheduled_jobs
ALTER TABLE scheduled_jobs
ADD COLUMN IF NOT EXISTS last_run_status TEXT,
ADD COLUMN IF NOT EXISTS last_run_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- Fix existing job types to match code
UPDATE scheduled_jobs SET job_type = 'fetch_rss' WHERE job_name = 'fetch-rss-feeds';
UPDATE scheduled_jobs SET job_type = 'fetch_executive_orders' WHERE job_name = 'fetch-executive-orders';
UPDATE scheduled_jobs SET job_type = 'track_state_actions' WHERE job_name = 'track-state-actions';
UPDATE scheduled_jobs SET job_type = 'send_briefings' WHERE job_name = 'send-daily-briefing';
UPDATE scheduled_jobs SET job_type = 'smart_alerting' WHERE job_name = 'smart-alerting';

-- Initialize next_run_at for all jobs
UPDATE scheduled_jobs 
SET next_run_at = calculate_next_run(schedule)
WHERE next_run_at IS NULL OR next_run_at < NOW();

-- Clean up stuck jobs
UPDATE job_executions
SET 
  status = 'failed',
  error_message = 'Job timeout - marked as failed during cleanup',
  completed_at = NOW(),
  duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER * 1000
WHERE status = 'running' 
  AND started_at < NOW() - INTERVAL '1 hour';