
-- Fix security definer views by recreating them with SECURITY INVOKER
-- This ensures views run with the permissions of the querying user, not the view creator

-- Drop and recreate backfill_monitoring view with SECURITY INVOKER
DROP VIEW IF EXISTS public.backfill_monitoring;

CREATE VIEW public.backfill_monitoring
WITH (security_invoker = true)
AS
WITH stats AS (
  SELECT 
    count(*) FILTER (WHERE ai_processed = false AND ai_relevance_score >= 0.1) AS unprocessed,
    count(*) FILTER (WHERE ai_processed = true) AS processed,
    count(*) FILTER (WHERE ai_processed = true AND created_at >= (now() - '1 hour'::interval)) AS processed_last_hour,
    count(*) FILTER (WHERE ai_processed = true AND created_at >= (now() - '24 hours'::interval)) AS processed_last_day
  FROM public.bluesky_posts
)
SELECT 
  unprocessed,
  processed,
  round((processed::numeric / NULLIF(unprocessed + processed, 0)::numeric) * 100::numeric, 2) AS completion_percentage,
  processed_last_hour,
  processed_last_day,
  round((processed_last_hour::numeric / 60::numeric), 2) AS posts_per_minute,
  CASE
    WHEN processed_last_hour > 0 THEN round((unprocessed::numeric / processed_last_hour::numeric), 2)
    ELSE NULL::numeric
  END AS hours_remaining_at_current_rate,
  CASE
    WHEN unprocessed = 0 THEN '✅ COMPLETE'::text
    WHEN processed_last_hour > 100 THEN '🚀 PROCESSING FAST'::text
    WHEN processed_last_hour > 0 THEN '⚡ PROCESSING'::text
    ELSE '⏸️ PAUSED'::text
  END AS status
FROM stats;

-- Drop and recreate bluesky_trending_topics view with SECURITY INVOKER
DROP VIEW IF EXISTS public.bluesky_trending_topics;

CREATE VIEW public.bluesky_trending_topics
WITH (security_invoker = true)
AS
SELECT 
  topic,
  velocity,
  mentions_last_hour AS "1h",
  mentions_last_6_hours AS "6h",
  mentions_last_24_hours AS "24h",
  sentiment_avg,
  CASE
    WHEN is_trending THEN '🔥 TRENDING'::text
    ELSE ''::text
  END AS status,
  calculated_at
FROM public.bluesky_trends
WHERE mentions_last_24_hours > 0
ORDER BY is_trending DESC, velocity DESC, mentions_last_24_hours DESC
LIMIT 20;

-- Grant SELECT permissions on these views to authenticated users
GRANT SELECT ON public.backfill_monitoring TO authenticated;
GRANT SELECT ON public.bluesky_trending_topics TO authenticated;
