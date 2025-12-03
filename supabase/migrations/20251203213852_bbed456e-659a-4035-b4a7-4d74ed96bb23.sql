-- Fix security warnings: Set search_path for functions
ALTER FUNCTION calculate_sentiment_trend(NUMERIC, NUMERIC) SET search_path = public;
ALTER FUNCTION refresh_daily_group_sentiment() SET search_path = public;

-- Remove materialized views from public API access (optional - they're read-only anyway)
REVOKE SELECT ON mv_group_sentiment_daily FROM anon;
REVOKE SELECT ON mv_unified_trends FROM anon;