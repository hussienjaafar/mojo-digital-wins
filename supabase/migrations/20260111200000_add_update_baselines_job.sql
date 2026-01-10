-- Add update_baselines to scheduled_jobs
-- CRITICAL FIX: This job must run before detect_trend_events (which depends on it)
-- Without this job, detect_trend_events will be skipped due to dependency check

INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES (
  'Update Trend Baselines',
  'update_baselines',
  '*/30 * * * *',  -- Run every 30 minutes (before detect_trend_events)
  'update-trend-baselines',
  true,
  'Calculate rolling baseline metrics (7d/30d) for trend detection'
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  is_active = true,
  schedule = '*/30 * * * *',
  endpoint = EXCLUDED.endpoint,
  description = EXCLUDED.description,
  updated_at = now();

-- Add pipeline heartbeat for the new job
INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'update_baselines',
  'Update Trend Baselines',
  60,  -- 1 hour SLA
  true -- Critical because detect_trend_events depends on it
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes,
  is_critical = EXCLUDED.is_critical;
