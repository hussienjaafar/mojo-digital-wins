-- Fix scheduled_jobs metadata so last_run/next_run can be updated reliably
-- Root cause: cron_expression null caused calculate_next_run to fail, leaving last_run_at/next_run_at unset.

-- Backfill cron_expression/schedule and next_run_at
UPDATE public.scheduled_jobs
SET
  cron_expression = COALESCE(cron_expression, schedule, '*/10 * * * *'),
  schedule = COALESCE(schedule, cron_expression, '*/10 * * * *'),
  next_run_at = COALESCE(next_run_at, now())
WHERE cron_expression IS NULL OR schedule IS NULL OR next_run_at IS NULL;

-- Harden calculate_next_run to handle NULL/empty cron expressions
CREATE OR REPLACE FUNCTION public.calculate_next_run(cron_expr TEXT, from_time TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ AS $$
DECLARE
  expr TEXT := COALESCE(NULLIF(TRIM(cron_expr), ''), '*/10 * * * *');
  parts TEXT[];
  minute_part TEXT;
  hour_part TEXT;
BEGIN
  parts := string_to_array(expr, ' ');

  IF array_length(parts, 1) < 5 THEN
    RETURN from_time + interval '10 minutes';
  END IF;

  minute_part := parts[1];
  hour_part := parts[2];

  -- */N minute patterns
  IF minute_part LIKE '*/%' THEN
    RETURN from_time + (substring(minute_part from 3)::int * interval '1 minute');
  END IF;

  -- */N hour patterns
  IF hour_part LIKE '*/%' THEN
    RETURN from_time + (substring(hour_part from 3)::int * interval '1 hour');
  END IF;

  RETURN from_time + interval '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Update update_job_after_execution to use coalesced cron expression
CREATE OR REPLACE FUNCTION public.update_job_after_execution(
  p_job_id UUID,
  p_status TEXT,
  p_duration_ms INTEGER,
  p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  expr TEXT;
BEGIN
  SELECT COALESCE(schedule, cron_expression, '*/10 * * * *') INTO expr FROM public.scheduled_jobs WHERE id = p_job_id;

  UPDATE public.scheduled_jobs
  SET
    last_run_at = now(),
    last_run_status = p_status,
    last_run_duration_ms = p_duration_ms,
    last_error = p_error,
    run_count = run_count + 1,
    failure_count = CASE WHEN p_status = 'failed' THEN failure_count + 1 ELSE failure_count END,
    next_run_at = calculate_next_run(expr, now()),
    updated_at = now(),
    cron_expression = expr,
    schedule = expr
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
