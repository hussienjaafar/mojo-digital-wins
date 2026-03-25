-- ============================================================================
-- CRITICAL FIX: Scheduler and Pipeline Remediation
-- ============================================================================
-- This migration fixes the "No actionable signals" issue by:
-- 1. Enabling required extensions (pg_cron, pg_net)
-- 2. Populating scheduled_jobs table
-- 3. Creating trend_events_active view
-- 4. Setting up health check function
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable Required Extensions
-- ============================================================================

-- Enable pg_cron for scheduling (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- STEP 2: Populate Scheduled Jobs Table
-- ============================================================================

-- Ensure scheduled_jobs table exists with correct schema
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert all required scheduled jobs
INSERT INTO scheduled_jobs (job_name, job_type, schedule, endpoint, is_active, description)
VALUES
  -- TIER 1: Critical Ingestion (every 5-15 min)
  ('fetch_google_news', 'fetch_news', '*/5 * * * *',
   '/functions/v1/fetch-google-news', true,
   'Fetch Google News political articles'),

  ('fetch_rss_feeds', 'fetch_rss', '*/15 * * * *',
   '/functions/v1/fetch-rss-feeds', true,
   'Fetch RSS feed articles from configured sources'),

  -- TIER 1: Critical Processing (every 5-15 min)
  ('detect_trend_events', 'detect_trends', '*/5 * * * *',
   '/functions/v1/detect-trend-events', true,
   'Detect trending events and set is_trending flags'),

  ('extract_trend_entities', 'extract_entities', '*/15 * * * *',
   '/functions/v1/extract-trend-entities', true,
   'Extract politicians, orgs, legislation from trends'),

  ('tag_trend_policy_domains', 'tag_domains', '*/15 * * * *',
   '/functions/v1/tag-trend-policy-domains', true,
   'Tag trends with policy domains'),

  ('tag_trend_geographies', 'tag_geo', '*/15 * * * *',
   '/functions/v1/tag-trend-geographies', true,
   'Tag trends with geographic regions'),

  -- TIER 1: Critical Scoring (every 15 min)
  ('compute_org_relevance', 'compute_relevance', '*/15 * * * *',
   '/functions/v1/compute-org-relevance', true,
   'Compute organization-specific relevance scores'),

  ('match_entity_watchlist', 'match_watchlist', '*/15 * * * *',
   '/functions/v1/match-entity-watchlist', true,
   'Match trends against org watchlists'),

  -- TIER 2: Learning (hourly)
  ('update_org_affinities', 'learn_affinities', '0 * * * *',
   '/functions/v1/update-org-affinities', true,
   'Update topic affinity scores from user behavior'),

  ('correlate_trends_campaigns', 'correlate', '30 * * * *',
   '/functions/v1/correlate-trends-campaigns', true,
   'Correlate trends with campaign performance'),

  -- TIER 3: Maintenance (daily)
  ('decay_stale_affinities', 'decay_affinities', '0 4 * * *',
   '/functions/v1/decay-stale-affinities', true,
   'Decay old affinity scores to prevent stale data'),

  ('ttl_cleanup', 'cleanup', '0 3 * * *',
   '/functions/v1/ttl-cleanup', true,
   'Clean up expired cache and old data'),

  ('cleanup_old_cache', 'cleanup', '0 5 * * 0',
   '/functions/v1/cleanup-old-cache', true,
   'Weekly cleanup of old cache entries'),

  -- Social Media (every 10-15 min)
  ('collect_bluesky_posts', 'fetch_social', '*/10 * * * *',
   '/functions/v1/collect-bluesky-posts', true,
   'Collect political posts from Bluesky'),

  ('analyze_bluesky_posts', 'analyze_social', '*/15 * * * *',
   '/functions/v1/analyze-bluesky-posts', true,
   'Analyze Bluesky posts for sentiment and topics'),

  ('calculate_bluesky_trends', 'calc_social_trends', '*/15 * * * *',
   '/functions/v1/calculate-bluesky-trends', true,
   'Calculate trending topics from Bluesky')

ON CONFLICT (job_name) DO UPDATE SET
  is_active = true,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Create/Update trend_events_active View
-- ============================================================================

DROP VIEW IF EXISTS public.trend_events_active;

CREATE VIEW public.trend_events_active AS
SELECT
  te.id,
  te.event_key,
  te.event_title,
  te.canonical_label,
  te.first_seen_at,
  te.last_seen_at,
  te.peak_at,
  te.baseline_7d,
  te.baseline_30d,
  te.current_1h,
  te.current_6h,
  te.current_24h,
  te.velocity,
  te.velocity_1h,
  te.velocity_6h,
  te.acceleration,
  te.trend_score,
  te.z_score_velocity,
  te.confidence_score,
  te.confidence_factors,
  te.is_trending,
  te.is_breaking,
  te.is_event_phrase,
  te.trend_stage,
  te.source_count,
  te.news_source_count,
  te.social_source_count,
  te.corroboration_score,
  te.evidence_count,
  te.top_headline,
  te.sentiment_score,
  te.sentiment_label,
  te.context_terms,
  te.context_phrases,
  te.context_summary,
  te.label_quality,
  te.label_source,
  te.related_phrases,
  te.cluster_id,
  te.policy_domains,
  te.geographies,
  te.geo_level,
  te.politicians_mentioned,
  te.organizations_mentioned,
  te.legislation_mentioned,
  -- Computed fields
  CASE
    WHEN te.last_seen_at > NOW() - INTERVAL '1 hour' THEN 'fresh'
    WHEN te.last_seen_at > NOW() - INTERVAL '6 hours' THEN 'recent'
    WHEN te.last_seen_at > NOW() - INTERVAL '24 hours' THEN 'aging'
    ELSE 'stale'
  END as freshness,
  COALESCE(te.baseline_7d, 0) as safe_baseline,
  CASE
    WHEN te.baseline_7d > 0 THEN
      ROUND(((te.current_24h / 24.0 - te.baseline_7d) / te.baseline_7d * 100)::numeric, 1)
    ELSE 0
  END as baseline_delta_pct,
  -- Rank score for sorting (Twitter-like)
  COALESCE(te.trend_score, 0) +
    CASE WHEN te.is_breaking THEN 50 ELSE 0 END +
    COALESCE(te.z_score_velocity, 0) * 10 as rank_score
FROM trend_events te
WHERE te.last_seen_at > NOW() - INTERVAL '48 hours';

-- Grant access to the view
GRANT SELECT ON public.trend_events_active TO authenticated;
GRANT SELECT ON public.trend_events_active TO anon;

-- ============================================================================
-- STEP 4: Create Pipeline Health Check Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_pipeline_health()
RETURNS TABLE(
  component TEXT,
  status TEXT,
  last_activity TIMESTAMPTZ,
  minutes_since_activity NUMERIC,
  recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- Check trend_evidence freshness
  SELECT
    'trend_evidence'::TEXT,
    CASE
      WHEN NOW() - MAX(te.discovered_at) < INTERVAL '10 minutes' THEN 'HEALTHY'
      WHEN NOW() - MAX(te.discovered_at) < INTERVAL '30 minutes' THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(te.discovered_at),
    ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(te.discovered_at)))/60),
    CASE
      WHEN NOW() - MAX(te.discovered_at) > INTERVAL '30 minutes'
      THEN 'Check fetch-google-news and fetch-rss-feeds'
      ELSE 'OK'
    END
  FROM trend_evidence te

  UNION ALL

  -- Check trend_events freshness
  SELECT
    'trend_events'::TEXT,
    CASE
      WHEN NOW() - MAX(tev.last_seen_at) < INTERVAL '15 minutes' THEN 'HEALTHY'
      WHEN NOW() - MAX(tev.last_seen_at) < INTERVAL '60 minutes' THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(tev.last_seen_at),
    ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(tev.last_seen_at)))/60),
    CASE
      WHEN NOW() - MAX(tev.last_seen_at) > INTERVAL '60 minutes'
      THEN 'Check detect-trend-events cron job'
      ELSE 'OK'
    END
  FROM trend_events tev
  WHERE tev.is_trending = true

  UNION ALL

  -- Check scheduler health
  SELECT
    'job_executions'::TEXT,
    CASE
      WHEN COUNT(*) > 0 AND NOW() - MAX(je.started_at) < INTERVAL '5 minutes' THEN 'HEALTHY'
      WHEN COUNT(*) > 0 THEN 'WARNING'
      ELSE 'CRITICAL'
    END,
    MAX(je.started_at),
    CASE WHEN COUNT(*) > 0 THEN ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(je.started_at)))/60) ELSE 9999 END,
    CASE
      WHEN COUNT(*) = 0 THEN 'Scheduler not running - check pg_cron setup'
      ELSE 'OK'
    END
  FROM job_executions je
  WHERE je.started_at > NOW() - INTERVAL '1 hour';

END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_pipeline_health() TO authenticated;

-- ============================================================================
-- STEP 5: Create System Alerts Table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  message TEXT NOT NULL,
  context JSONB,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for querying recent alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_created ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unack ON system_alerts(acknowledged, created_at DESC) WHERE acknowledged = false;

-- ============================================================================
-- STEP 6: Diagnostic Query - Run After Migration
-- ============================================================================

-- This comment contains the diagnostic query to run after migration:
-- SELECT * FROM check_pipeline_health();
--
-- Expected results:
-- | component        | status  | minutes_since_activity | recommendation |
-- |------------------|---------|------------------------|----------------|
-- | trend_evidence   | HEALTHY | <10                    | OK             |
-- | trend_events     | HEALTHY | <15                    | OK             |
-- | job_executions   | HEALTHY | <5                     | OK             |

-- ============================================================================
-- NOTES FOR MANUAL STEPS (Cannot be done in migration)
-- ============================================================================
--
-- After this migration runs, you must:
--
-- 1. Set up Vault secrets (in Supabase Dashboard > Database > Vault):
--    - project_url: https://nuclmzoasgydubdshtab.supabase.co
--    - cron_secret: [generate with: openssl rand -base64 32]
--    - service_role_key: [from Supabase Dashboard > Settings > API]
--
-- 2. Set CRON_SECRET in Edge Function secrets:
--    - Supabase Dashboard > Settings > Edge Functions > Add Secret
--    - Name: CRON_SECRET
--    - Value: [same as vault cron_secret]
--
-- 3. Create master scheduler cron job (run in SQL Editor):
--    SELECT cron.schedule(
--      'master-scheduler',
--      '* * * * *',
--      $$
--      SELECT net.http_post(
--        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
--               || '/functions/v1/run-scheduled-jobs',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
--        ),
--        body := jsonb_build_object('triggered_by', 'pg_cron', 'timestamp', NOW()::text)
--      ) AS request_id;
--      $$
--    );
--
-- 4. Manually trigger pipeline (one-time):
--    curl -X POST "https://nuclmzoasgydubdshtab.supabase.co/functions/v1/detect-trend-events" \
--      -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
--      -H "x-cron-secret: [CRON_SECRET]" \
--      -H "Content-Type: application/json" \
--      -d '{"force_full_scan": true}'
