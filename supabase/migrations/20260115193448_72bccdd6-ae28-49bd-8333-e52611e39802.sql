-- Part 1: Unschedule all intelligence-related cron jobs
SELECT cron.unschedule('smart-alerting-every-30-min');
SELECT cron.unschedule('daily-briefing-email-8am');
SELECT cron.unschedule('extract-trending-topics');

-- Part 2: Deactivate jobs in scheduled_jobs table (preserves config for re-enabling)
UPDATE scheduled_jobs 
SET is_active = false
WHERE job_name IN (
  'Detect Spikes',
  'Send Spike Alerts', 
  'send-daily-briefing',
  'smart-alerting'
);

-- Part 3: Mark pending spike alerts as cancelled
UPDATE spike_alerts 
SET status = 'cancelled'
WHERE status = 'pending';