-- Add refresh-meta-tokens to scheduled_jobs
-- This job runs daily to proactively refresh Meta API tokens before they expire

INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Refresh Meta Tokens',
  'refresh_meta_tokens',
  '0 3 * * *',  -- Run daily at 3 AM UTC
  'refresh-meta-tokens',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  is_active = true,
  schedule = '0 3 * * *',
  endpoint = EXCLUDED.endpoint,
  updated_at = now();

-- Add pipeline heartbeat for the new job
INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'refresh_meta_tokens',
  'Meta Token Refresh',
  1440,  -- 24 hour SLA (runs once daily)
  true   -- Critical because token expiry breaks Meta sync
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes,
  is_critical = EXCLUDED.is_critical;
