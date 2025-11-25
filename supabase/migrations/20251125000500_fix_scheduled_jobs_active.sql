-- Normalize scheduled_jobs active flags and next_run_at
UPDATE public.scheduled_jobs
SET
  is_enabled = COALESCE(is_enabled, true),
  is_active = COALESCE(is_active, is_enabled, true),
  next_run_at = COALESCE(next_run_at, now())
WHERE is_active IS NULL OR is_enabled IS NULL OR next_run_at IS NULL;

-- Ensure schedule/cron_expression are populated for all rows (defense in depth)
UPDATE public.scheduled_jobs
SET
  cron_expression = COALESCE(cron_expression, schedule, '*/10 * * * *'),
  schedule = COALESCE(schedule, cron_expression, '*/10 * * * *')
WHERE cron_expression IS NULL OR schedule IS NULL;
