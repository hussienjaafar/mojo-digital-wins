-- Speed up Switchboard SMS sync from 6h to 2h for fresher ROI data
-- Remove daily ROI calculation job (dashboard computes ROI live at query time)

-- 1. Increase Switchboard sync to every 2 hours
UPDATE public.scheduled_jobs
SET schedule = '0 */2 * * *'
WHERE job_type = 'sync_switchboard_sms';

-- 2. Remove unnecessary calculate_roi job
-- The dashboard already computes ROI live from actblue_transactions + meta/sms spend
-- The calculate-roi edge function writes to daily_aggregated_metrics which the dashboard doesn't read
DELETE FROM public.scheduled_jobs
WHERE job_type = 'calculate_roi';
