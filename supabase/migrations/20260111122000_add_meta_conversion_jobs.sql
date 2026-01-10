-- Add retry-meta-conversions scheduled job
INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Retry Meta Conversions',
  'retry_meta_conversions',
  '*/5 * * * *',
  'retry-meta-conversions',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  is_active = true,
  schedule = '*/5 * * * *',
  endpoint = EXCLUDED.endpoint,
  updated_at = now();

INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'retry_meta_conversions',
  'Meta Conversion Retries',
  10,
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes,
  is_critical = EXCLUDED.is_critical;

-- Add ActBlue backfill job
INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Backfill ActBlue Conversions',
  'backfill_actblue_conversions',
  '15 * * * *',
  'backfill-actblue-conversions',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  is_active = true,
  schedule = '15 * * * *',
  endpoint = EXCLUDED.endpoint,
  updated_at = now();

INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'backfill_actblue_conversions',
  'ActBlue Conversion Backfill',
  120,
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes,
  is_critical = EXCLUDED.is_critical;
