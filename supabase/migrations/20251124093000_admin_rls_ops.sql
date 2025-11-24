-- Enable RLS and admin-only access for ops tables/views

-- job_failures
ALTER TABLE IF EXISTS public.job_failures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_job_failures" ON public.job_failures;
CREATE POLICY "admin_read_job_failures" ON public.job_failures
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- job_executions
ALTER TABLE IF EXISTS public.job_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_job_executions" ON public.job_executions;
CREATE POLICY "admin_read_job_executions" ON public.job_executions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- scheduled_jobs (read only for admins)
ALTER TABLE IF EXISTS public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "admin_read_scheduled_jobs" ON public.scheduled_jobs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- backfill_status
ALTER TABLE IF EXISTS public.backfill_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_read_backfill_status" ON public.backfill_status;
CREATE POLICY "admin_read_backfill_status" ON public.backfill_status
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- For the view backfill_monitoring we cannot attach RLS; ensure underlying tables have policies.
