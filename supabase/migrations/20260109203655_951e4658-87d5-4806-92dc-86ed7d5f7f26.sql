
-- ============================================
-- SECURITY FIXES MIGRATION
-- ============================================

-- ============================================
-- 1. Fix functions without search_path
-- ============================================

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_entity_watchlist_timestamp function  
CREATE OR REPLACE FUNCTION public.update_entity_watchlist_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Add RLS policy to cron_config table
-- ============================================

-- cron_config should only be accessible by admins
CREATE POLICY "Admins can manage cron_config"
ON public.cron_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 3. Restrict "Service role" policies to actually require service_role
-- These policies currently use USING (true) which allows any authenticated user
-- We'll update them to check for service_role or admin role
-- ============================================

-- article_dedupe_registry
DROP POLICY IF EXISTS "Service role manages article_dedupe_registry" ON public.article_dedupe_registry;
CREATE POLICY "Service role manages article_dedupe_registry"
ON public.article_dedupe_registry
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- attribution_matcher_runs
DROP POLICY IF EXISTS "Service role can insert attribution runs" ON public.attribution_matcher_runs;
CREATE POLICY "Service role can insert attribution runs"
ON public.attribution_matcher_runs
FOR INSERT
TO service_role
WITH CHECK (true);

-- attribution_model_log  
DROP POLICY IF EXISTS "System can insert attribution logs" ON public.attribution_model_log;
CREATE POLICY "System can insert attribution logs"
ON public.attribution_model_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- backfill_status
DROP POLICY IF EXISTS "Service role can manage backfill status" ON public.backfill_status;
CREATE POLICY "Service role can manage backfill status"
ON public.backfill_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- bluesky_velocity_metrics
DROP POLICY IF EXISTS "Service role can manage velocity metrics" ON public.bluesky_velocity_metrics;
CREATE POLICY "Service role can manage velocity metrics"
ON public.bluesky_velocity_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- breaking_news_clusters
DROP POLICY IF EXISTS "Service role can manage breaking news" ON public.breaking_news_clusters;
CREATE POLICY "Service role can manage breaking news"
ON public.breaking_news_clusters
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- daily_briefings
DROP POLICY IF EXISTS "Service role can manage briefings" ON public.daily_briefings;
CREATE POLICY "Service role can manage briefings"
ON public.daily_briefings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- daily_group_sentiment
DROP POLICY IF EXISTS "Service role can manage group sentiment" ON public.daily_group_sentiment;
CREATE POLICY "Service role can manage group sentiment"
ON public.daily_group_sentiment
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- detected_anomalies
DROP POLICY IF EXISTS "Service can manage anomalies" ON public.detected_anomalies;
CREATE POLICY "Service can manage anomalies"
ON public.detected_anomalies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- entity_aliases
DROP POLICY IF EXISTS "Allow service role to manage" ON public.entity_aliases;
CREATE POLICY "Allow service role to manage"
ON public.entity_aliases
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- entity_mentions
DROP POLICY IF EXISTS "Service insert mentions" ON public.entity_mentions;
CREATE POLICY "Service insert mentions"
ON public.entity_mentions
FOR INSERT
TO service_role
WITH CHECK (true);

-- entity_trends
DROP POLICY IF EXISTS "Service manage trends" ON public.entity_trends;
CREATE POLICY "Service manage trends"
ON public.entity_trends
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- google_news_articles
DROP POLICY IF EXISTS "Service can insert google news" ON public.google_news_articles;
CREATE POLICY "Service can insert google news"
ON public.google_news_articles
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update google news" ON public.google_news_articles;
CREATE POLICY "Service can update google news"
ON public.google_news_articles
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- google_news_sources
DROP POLICY IF EXISTS "Service role manages google_news_sources" ON public.google_news_sources;
CREATE POLICY "Service role manages google_news_sources"
ON public.google_news_sources
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- organization_mentions
DROP POLICY IF EXISTS "Service role can manage org mentions" ON public.organization_mentions;
CREATE POLICY "Service role can manage org mentions"
ON public.organization_mentions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- pipeline_runs
DROP POLICY IF EXISTS "System can insert pipeline runs" ON public.pipeline_runs;
CREATE POLICY "System can insert pipeline runs"
ON public.pipeline_runs
FOR INSERT
TO service_role
WITH CHECK (true);

-- polling_data
DROP POLICY IF EXISTS "Service manage polling" ON public.polling_data;
CREATE POLICY "Service manage polling"
ON public.polling_data
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- processing_batches
DROP POLICY IF EXISTS "Service can manage processing batches" ON public.processing_batches;
CREATE POLICY "Service can manage processing batches"
ON public.processing_batches
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- reddit_posts
DROP POLICY IF EXISTS "Service can insert reddit posts" ON public.reddit_posts;
CREATE POLICY "Service can insert reddit posts"
ON public.reddit_posts
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update reddit posts" ON public.reddit_posts;
CREATE POLICY "Service can update reddit posts"
ON public.reddit_posts
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- sentiment_snapshots
DROP POLICY IF EXISTS "Service can manage sentiment snapshots" ON public.sentiment_snapshots;
CREATE POLICY "Service can manage sentiment snapshots"
ON public.sentiment_snapshots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- source_tiers
DROP POLICY IF EXISTS "Service role manages source_tiers" ON public.source_tiers;
CREATE POLICY "Service role manages source_tiers"
ON public.source_tiers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- spike_alerts
DROP POLICY IF EXISTS "Service role can manage spike alerts" ON public.spike_alerts;
CREATE POLICY "Service role can manage spike alerts"
ON public.spike_alerts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- topic_baselines
DROP POLICY IF EXISTS "Allow service role manage topic_baselines" ON public.topic_baselines;
CREATE POLICY "Allow service role manage topic_baselines"
ON public.topic_baselines
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trend_anomalies
DROP POLICY IF EXISTS "Service role can manage anomalies" ON public.trend_anomalies;
CREATE POLICY "Service role can manage anomalies"
ON public.trend_anomalies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trend_baselines
DROP POLICY IF EXISTS "Service role manages trend_baselines" ON public.trend_baselines;
CREATE POLICY "Service role manages trend_baselines"
ON public.trend_baselines
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trend_clusters
DROP POLICY IF EXISTS "Service can manage trend clusters" ON public.trend_clusters;
CREATE POLICY "Service can manage trend clusters"
ON public.trend_clusters
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trend_events
DROP POLICY IF EXISTS "Service role manages trend_events" ON public.trend_events;
CREATE POLICY "Service role manages trend_events"
ON public.trend_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trend_evidence
DROP POLICY IF EXISTS "Service role manages trend_evidence" ON public.trend_evidence;
CREATE POLICY "Service role manages trend_evidence"
ON public.trend_evidence
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- trending_topics
DROP POLICY IF EXISTS "Service role can manage trending topics" ON public.trending_topics;
CREATE POLICY "Service role can manage trending topics"
ON public.trending_topics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. Revoke direct API access to materialized views
-- ============================================

-- Revoke access from anon and authenticated roles
REVOKE SELECT ON public.mv_daily_metrics_summary FROM anon, authenticated;
REVOKE SELECT ON public.mv_group_sentiment_daily FROM anon, authenticated;
REVOKE SELECT ON public.mv_unified_trends FROM anon, authenticated;

-- Grant only to service_role
GRANT SELECT ON public.mv_daily_metrics_summary TO service_role;
GRANT SELECT ON public.mv_group_sentiment_daily TO service_role;
GRANT SELECT ON public.mv_unified_trends TO service_role;

-- ============================================
-- 5. Add admin read policies for service-managed tables
-- (So admins can still view this data in the admin panel)
-- ============================================

CREATE POLICY "Admins can view attribution_matcher_runs"
ON public.attribution_matcher_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view attribution_model_log"
ON public.attribution_model_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view backfill_status"
ON public.backfill_status
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view pipeline_runs"
ON public.pipeline_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
