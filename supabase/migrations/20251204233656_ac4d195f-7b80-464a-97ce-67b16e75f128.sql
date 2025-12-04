-- Phase 2: Update calculate-trend-clusters job to run every 5 minutes
UPDATE scheduled_jobs 
SET 
  schedule = '*/5 * * * *',
  next_run_at = NOW() + INTERVAL '5 minutes'
WHERE job_type = 'calculate_trend_clusters' OR job_name ILIKE '%trend%cluster%';