-- Add detect-duplicates to scheduled_jobs
INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Detect Duplicate Articles',
  'detect_duplicates',
  '*/30 * * * *',
  'detect-duplicates',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  is_active = true,
  schedule = '*/30 * * * *',
  endpoint = EXCLUDED.endpoint,
  updated_at = now();

-- Add pipeline heartbeat for the new job
INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'detect_duplicates',
  'Duplicate Detection',
  120,
  false
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes,
  is_critical = EXCLUDED.is_critical;
