
-- Remove the inefficient run-scheduled-jobs cron (it times out)
SELECT cron.unschedule('run-scheduled-jobs-every-minute');
SELECT cron.unschedule('run-scheduled-jobs-every-5-min');

-- Add direct pg_cron jobs for Bluesky functions (faster, no timeout cascade)

-- Bluesky Stream: Every 2 minutes
SELECT cron.schedule(
  'bluesky-stream-every-2-min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/bluesky-stream',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := jsonb_build_object('durationMs', 45000)
  ) AS request_id;
  $$
);

-- Analyze Bluesky Posts: Every 10 minutes
SELECT cron.schedule(
  'analyze-bluesky-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/analyze-bluesky-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := jsonb_build_object('batchSize', 50)
  ) AS request_id;
  $$
);

-- Correlate Social & News: Every 15 minutes
SELECT cron.schedule(
  'correlate-social-news-every-15-min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/correlate-social-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
