-- Fix scheduled_jobs unique constraint issue
DROP INDEX IF EXISTS public.scheduled_jobs_job_type_key;

-- Register the scheduled job for CAPI outbox processing
INSERT INTO public.scheduled_jobs (
  job_name,
  job_type,
  endpoint,
  schedule,
  is_active
)
SELECT 
  'process-meta-capi-outbox',
  'capi_outbox',
  'process-meta-capi-outbox',
  '*/1 * * * *',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.scheduled_jobs WHERE job_name = 'process-meta-capi-outbox'
);