-- Insert new jobs using the correct column names from existing schema
INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, next_run_at) VALUES
  ('Aggregate Sentiment', 'aggregate_sentiment', '0 * * * *', '/functions/v1/aggregate-sentiment', true, NOW()),
  ('Detect Anomalies', 'detect_anomalies', '0 */6 * * *', '/functions/v1/detect-anomalies', true, NOW()),
  ('Cleanup Old Cache', 'cleanup_cache', '0 2 * * *', '/functions/v1/cleanup-old-cache', true, NOW() + INTERVAL '1 day')
ON CONFLICT (job_name) DO UPDATE SET
  schedule = EXCLUDED.schedule,
  is_active = EXCLUDED.is_active,
  endpoint = EXCLUDED.endpoint;