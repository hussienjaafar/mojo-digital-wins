-- Update bluesky-stream cron job to use 30-second duration (was 45s)
-- This prevents CPU timeout errors and matches the updated edge function code

SELECT cron.alter_job(
  job_id := 9,
  schedule := '*/2 * * * *',
  command := $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/bluesky-stream',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := jsonb_build_object('durationMs', 30000)
  ) AS request_id;
  $$
);