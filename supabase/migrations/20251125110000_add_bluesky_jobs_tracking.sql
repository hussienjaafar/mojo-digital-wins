-- Ensure bluesky jobs exist in scheduled_jobs with endpoints for ops visibility
INSERT INTO public.scheduled_jobs (job_name, job_type, description, schedule, endpoint, is_active, next_run_at)
VALUES
  ('Collect Bluesky Stream', 'collect_bluesky', 'Ingest Bluesky posts via JetStream', '*/2 * * * *', '/functions/v1/bluesky-stream', true, now()),
  ('Analyze Bluesky Posts', 'analyze_bluesky', 'AI analysis of Bluesky posts', '*/10 * * * *', '/functions/v1/analyze-bluesky-posts', true, now()),
  ('Calculate Bluesky Trends', 'calculate_bluesky_trends', 'Update Bluesky trending topics velocity', '*/10 * * * *', '/functions/v1/calculate-bluesky-trends', true, now())
ON CONFLICT (job_name) DO NOTHING;
