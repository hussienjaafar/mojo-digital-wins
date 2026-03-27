-- Schedule ActBlue daily backfill, reconciliation, and ROI calculation
-- These run sequentially overnight so dashboard data is fresh by morning

-- 1. ActBlue CSV Backfill — runs at 3 AM ET (7 AM UTC) daily
-- Catches any donations missed by webhooks over the past 7 days
INSERT INTO public.scheduled_jobs (job_name, job_type, endpoint, schedule, is_active)
VALUES (
  'ActBlue Daily Backfill',
  'backfill_actblue',
  'backfill-actblue-csv-orchestrator',
  '0 7 * * *',
  true
)
ON CONFLICT (job_type)
DO UPDATE SET
  schedule = '0 7 * * *',
  is_active = true,
  endpoint = 'backfill-actblue-csv-orchestrator';

-- 2. ActBlue Data Reconciliation — runs at 4 AM ET (8 AM UTC) daily
-- Verifies data consistency after backfill completes
INSERT INTO public.scheduled_jobs (job_name, job_type, endpoint, schedule, is_active)
VALUES (
  'ActBlue Reconciliation',
  'reconcile_actblue',
  'reconcile-actblue-data',
  '0 8 * * *',
  true
)
ON CONFLICT (job_type)
DO UPDATE SET
  schedule = '0 8 * * *',
  is_active = true,
  endpoint = 'reconcile-actblue-data';

-- 3. Daily ROI Calculation — runs at 5 AM ET (9 AM UTC) daily
-- Recalculates ROI across all channels after fresh data is available
INSERT INTO public.scheduled_jobs (job_name, job_type, endpoint, schedule, is_active)
VALUES (
  'Daily ROI Calculation',
  'calculate_roi',
  'calculate-roi',
  '0 9 * * *',
  true
)
ON CONFLICT (job_type)
DO UPDATE SET
  schedule = '0 9 * * *',
  is_active = true,
  endpoint = 'calculate-roi';

-- 4. Reduce ActBlue CSV sync from 6 hours to 4 hours for fresher data
UPDATE public.scheduled_jobs
SET schedule = '0 */4 * * *'
WHERE job_type = 'sync_actblue_csv';
