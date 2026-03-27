-- Ensure Switchboard SMS sync runs daily at 6 AM ET for all orgs
-- and attribution backfill runs after each sync

-- 1. Ensure sync_switchboard_sms job exists and is active
-- Schedule: every 6 hours (4x/day) to keep SMS data fresh
INSERT INTO public.scheduled_jobs (job_name, job_type, endpoint, schedule, is_active, priority)
VALUES (
  'Sync Switchboard SMS',
  'sync_switchboard_sms',
  'sync-switchboard-sms',
  '0 */6 * * *',
  true,
  5
)
ON CONFLICT (job_type)
DO UPDATE SET
  schedule = '0 */6 * * *',
  is_active = true,
  endpoint = 'sync-switchboard-sms';

-- 2. Ensure SMS attribution backfill runs daily at 7 AM ET
-- This catches any transactions that weren't attributed at webhook time
INSERT INTO public.scheduled_jobs (job_name, job_type, endpoint, schedule, is_active, priority)
VALUES (
  'SMS Attribution Backfill',
  'sync_sms_attribution',
  'sync-sms-campaign-attribution',
  '0 11 * * *',
  true,
  6
)
ON CONFLICT (job_type)
DO UPDATE SET
  schedule = '0 11 * * *',
  is_active = true,
  endpoint = 'sync-sms-campaign-attribution';

-- 3. Ensure the scheduled jobs runner cron is active
-- This checks the scheduled_jobs table every minute and fires due jobs
SELECT cron.schedule(
  'run-scheduled-jobs-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-scheduled-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
