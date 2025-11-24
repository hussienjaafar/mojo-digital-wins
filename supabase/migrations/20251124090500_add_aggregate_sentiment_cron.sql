-- Add pg_cron job for aggregate-sentiment edge function (hourly)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('aggregate-sentiment-hourly');

    PERFORM cron.schedule(
      'aggregate-sentiment-hourly',
      '0 * * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/aggregate-sentiment',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; skipping aggregate-sentiment schedule.';
  END IF;
END $$;
