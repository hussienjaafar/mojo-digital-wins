-- =============================================================================
-- PAUSE INTELLIGENCE ALERT SYSTEM
-- Temporarily disable all intelligence-related cron jobs until production ready
-- =============================================================================
-- To re-enable, run the migration: 20251123080500_add_direct_smart_alerting_cron.sql
-- or create a new migration that re-schedules these jobs

-- Unschedule smart alerting (breaking news detection, org mentions, briefings)
SELECT cron.unschedule('smart-alerting-every-30-min');

-- Unschedule daily briefing emails
SELECT cron.unschedule('daily-briefing-email-8am');

-- Unschedule trending topics extraction
SELECT cron.unschedule('extract-trending-topics-30min');

-- =============================================================================
-- VERIFY JOBS WERE REMOVED
-- =============================================================================
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM cron.job
  WHERE jobname IN (
    'smart-alerting-every-30-min',
    'daily-briefing-email-8am',
    'extract-trending-topics-30min'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INTELLIGENCE ALERTS PAUSED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Jobs remaining (should be 0): %', remaining_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Disabled jobs:';
  RAISE NOTICE '  - smart-alerting-every-30-min';
  RAISE NOTICE '  - daily-briefing-email-8am';
  RAISE NOTICE '  - extract-trending-topics-30min';
  RAISE NOTICE '';
  RAISE NOTICE 'Still active (system health):';
  RAISE NOTICE '  - ops-alerts-15m';
  RAISE NOTICE '';
  RAISE NOTICE 'To re-enable, create a new migration or';
  RAISE NOTICE 're-run 20251123080500_add_direct_smart_alerting_cron.sql';
  RAISE NOTICE '========================================';
END $$;

-- Add comment for documentation
COMMENT ON SCHEMA public IS 'Intelligence alert system PAUSED as of 2026-01-15. See migration 20260115100000_pause_intelligence_alerts.sql';
