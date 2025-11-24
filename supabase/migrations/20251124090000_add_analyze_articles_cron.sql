-- Add pg_cron job for analyze-articles edge function
-- Schedules small, continuous batches to avoid rate limits and keep analysis fresh

-- Remove any existing job to avoid duplicates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('analyze-articles-every-10-min');

    -- Schedule analyze-articles every 10 minutes with conservative defaults
    PERFORM cron.schedule(
      'analyze-articles-every-10-min',
      '*/10 * * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/analyze-articles',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'batchSize', 10,
          'requestDelayMs', 800
        )
      );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; skipping analyze-articles schedule.';
  END IF;
END $$;

-- Optional: ensure supporting indexes exist for the analysis queue
CREATE INDEX IF NOT EXISTS idx_articles_analysis_queue
ON public.articles (published_date DESC)
WHERE affected_groups IS NULL OR relevance_category IS NULL;
