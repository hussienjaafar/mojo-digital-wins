-- Fix materialized views exposed in API by revoking public access
REVOKE ALL ON public.mv_daily_metrics_summary FROM anon, authenticated;
REVOKE ALL ON public.mv_unified_trends FROM anon, authenticated;
REVOKE ALL ON public.mv_group_sentiment_daily FROM anon, authenticated;

-- Grant access only to service role (for internal use by edge functions)
GRANT SELECT ON public.mv_daily_metrics_summary TO service_role;
GRANT SELECT ON public.mv_unified_trends TO service_role;
GRANT SELECT ON public.mv_group_sentiment_daily TO service_role;

-- Fix function search_path security for functions that don't have it set
-- Update calculate_trend_velocity_v2 to have fixed search_path
CREATE OR REPLACE FUNCTION public.calculate_trend_velocity_v2(mentions_1h integer, mentions_6h integer, mentions_24h integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  hourly_rate NUMERIC;
  six_hour_rate NUMERIC;
  daily_rate NUMERIC;
  velocity NUMERIC;
BEGIN
  hourly_rate := COALESCE(mentions_1h, 0);
  six_hour_rate := COALESCE(mentions_6h, 0) / 6.0;
  daily_rate := COALESCE(mentions_24h, 0) / 24.0;
  
  IF daily_rate = 0 THEN
    IF hourly_rate > 0 THEN
      RETURN 1000;
    END IF;
    RETURN 0;
  END IF;
  
  velocity := ((hourly_rate - daily_rate) / daily_rate) * 100;
  
  RETURN ROUND(velocity, 2);
END;
$function$;

-- Update calculate_cross_source_score to have fixed search_path
CREATE OR REPLACE FUNCTION public.calculate_cross_source_score(google_count integer, reddit_count integer, bluesky_count integer, rss_count integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  sources_present INTEGER := 0;
  total_volume INTEGER;
  diversity_bonus NUMERIC;
BEGIN
  IF google_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF reddit_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF bluesky_count > 0 THEN sources_present := sources_present + 1; END IF;
  IF rss_count > 0 THEN sources_present := sources_present + 1; END IF;
  
  total_volume := COALESCE(google_count, 0) + COALESCE(reddit_count, 0) + 
                  COALESCE(bluesky_count, 0) + COALESCE(rss_count, 0);
  
  diversity_bonus := CASE sources_present
    WHEN 4 THEN 2.0
    WHEN 3 THEN 1.5
    WHEN 2 THEN 1.2
    ELSE 1.0
  END;
  
  RETURN ROUND((total_volume * diversity_bonus)::NUMERIC, 2);
END;
$function$;

-- Update deduplicate_topic_name to have fixed search_path
CREATE OR REPLACE FUNCTION public.deduplicate_topic_name(topic_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(topic_name));
  normalized := regexp_replace(normalized, '^(the|a|an)\s+', '', 'i');
  normalized := regexp_replace(normalized, '\s+(party|administration|government)$', '', 'i');
  RETURN normalized;
END;
$function$;

-- Update calculate_sentiment_trend to have fixed search_path
CREATE OR REPLACE FUNCTION public.calculate_sentiment_trend(current_sentiment numeric, previous_sentiment numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF previous_sentiment IS NULL THEN
    RETURN 'stable';
  END IF;
  
  IF current_sentiment > previous_sentiment + 0.1 THEN
    RETURN 'improving';
  ELSIF current_sentiment < previous_sentiment - 0.1 THEN
    RETURN 'declining';
  ELSE
    RETURN 'stable';
  END IF;
END;
$function$;