-- Schedule ops-alerts every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ops-alerts-15m');
    PERFORM cron.schedule(
      'ops-alerts-15m',
      '*/15 * * * *',
      $$
      SELECT net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/ops-alerts',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; skipping ops-alerts schedule.';
  END IF;
END $$;
