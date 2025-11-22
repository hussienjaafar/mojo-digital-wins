-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Drop existing job if it exists
SELECT cron.unschedule('run-scheduled-jobs-every-minute');

-- Create cron job to run every minute
SELECT cron.schedule(
  'run-scheduled-jobs-every-minute',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url := 'https://nuclmzoasgydubdshtab.supabase.co/functions/v1/run-scheduled-jobs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51Y2xtem9hc2d5ZHViZHNodGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDgxNTMsImV4cCI6MjA3ODQ4NDE1M30.-1EDAX7A5pQxtFs3a9M4R2BHBMbWkoMdA5NLWdZyEjo'
        ),
        body := jsonb_build_object('time', now()::text)
    ) as request_id;
  $$
);