-- Phase 4: Source health hardening and alerting - Complete migration

-- 1. Add health columns to rss_sources
ALTER TABLE public.rss_sources ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';
ALTER TABLE public.rss_sources ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
ALTER TABLE public.rss_sources ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.rss_sources ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 2. Add health columns to google_news_sources  
ALTER TABLE public.google_news_sources ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';
ALTER TABLE public.google_news_sources ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE public.google_news_sources ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 3. Create source_health_alerts table
CREATE TABLE IF NOT EXISTS public.source_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'google_news')),
  source_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('stale', 'failing', 'critical', 'deactivated', 'recovered')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  tier TEXT,
  tags TEXT[],
  details JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_source_health_alerts_unresolved 
  ON source_health_alerts(is_resolved, created_at DESC) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_source_health_alerts_source 
  ON source_health_alerts(source_id, source_type);

-- 4. Update the update_source_health function with auto-deactivation
CREATE OR REPLACE FUNCTION public.update_source_health(
  p_source_id UUID, 
  p_source_type TEXT, 
  p_success BOOLEAN, 
  p_error_message TEXT DEFAULT NULL, 
  p_items_fetched INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_backoff_mins INTEGER;
  v_current_errors INTEGER;
  v_source_name TEXT;
  v_tier TEXT;
  v_tags TEXT[];
  v_should_deactivate BOOLEAN := false;
  v_health_status TEXT;
BEGIN
  IF p_source_type = 'rss' THEN
    IF p_success THEN
      UPDATE rss_sources SET
        last_fetched_at = now(),
        last_success_at = now(),
        fetch_error = NULL,
        consecutive_errors = 0,
        success_count = COALESCE(success_count, 0) + 1,
        backoff_until = NULL,
        health_status = 'healthy',
        updated_at = now()
      WHERE id = p_source_id;
      
      UPDATE source_health_alerts 
      SET is_resolved = true, resolved_at = now(), resolved_by = 'auto_recovery'
      WHERE source_id = p_source_id AND source_type = 'rss' AND is_resolved = false;
    ELSE
      SELECT COALESCE(consecutive_errors, 0), name, tier, tags 
      INTO v_current_errors, v_source_name, v_tier, v_tags 
      FROM rss_sources WHERE id = p_source_id;
      
      v_current_errors := v_current_errors + 1;
      v_backoff_mins := LEAST(POWER(2, v_current_errors)::integer, 480);
      
      IF v_current_errors >= 5 THEN
        v_health_status := 'critical';
        v_should_deactivate := true;
      ELSIF v_current_errors >= 3 THEN
        v_health_status := 'failing';
      ELSE
        v_health_status := 'degraded';
      END IF;
      
      UPDATE rss_sources SET
        last_fetched_at = now(),
        last_error_at = now(),
        fetch_error = p_error_message,
        last_error_message = p_error_message,
        consecutive_errors = v_current_errors,
        error_count = COALESCE(error_count, 0) + 1,
        backoff_until = now() + (v_backoff_mins || ' minutes')::interval,
        health_status = v_health_status,
        is_active = CASE WHEN v_should_deactivate THEN false ELSE is_active END,
        deactivated_at = CASE WHEN v_should_deactivate THEN now() ELSE deactivated_at END,
        deactivation_reason = CASE WHEN v_should_deactivate THEN 'Auto-deactivated: 5+ consecutive failures' ELSE deactivation_reason END,
        updated_at = now()
      WHERE id = p_source_id;
      
      IF v_should_deactivate THEN
        INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
        VALUES (p_source_id, 'rss', v_source_name, 'deactivated', 'critical', v_tier, v_tags,
          jsonb_build_object('consecutive_errors', v_current_errors, 'last_error', p_error_message, 'deactivated_at', now()));
      ELSIF v_current_errors = 3 THEN
        INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
        VALUES (p_source_id, 'rss', v_source_name, 'failing', 'warning', v_tier, v_tags,
          jsonb_build_object('consecutive_errors', v_current_errors, 'last_error', p_error_message));
      END IF;
    END IF;
    
  ELSIF p_source_type = 'google_news' THEN
    IF p_success THEN
      UPDATE google_news_sources SET
        last_fetched_at = now(),
        last_success_at = now(),
        last_error = NULL,
        consecutive_errors = 0,
        success_count = COALESCE(success_count, 0) + 1,
        backoff_until = NULL,
        health_status = 'healthy',
        updated_at = now()
      WHERE id = p_source_id;
      
      UPDATE source_health_alerts 
      SET is_resolved = true, resolved_at = now(), resolved_by = 'auto_recovery'
      WHERE source_id = p_source_id AND source_type = 'google_news' AND is_resolved = false;
    ELSE
      SELECT COALESCE(consecutive_errors, 0), name, tier, tags 
      INTO v_current_errors, v_source_name, v_tier, v_tags 
      FROM google_news_sources WHERE id = p_source_id;
      
      v_current_errors := v_current_errors + 1;
      v_backoff_mins := LEAST(POWER(2, v_current_errors)::integer, 480);
      
      IF v_current_errors >= 5 THEN
        v_health_status := 'critical';
        v_should_deactivate := true;
      ELSIF v_current_errors >= 3 THEN
        v_health_status := 'failing';
      ELSE
        v_health_status := 'degraded';
      END IF;
      
      UPDATE google_news_sources SET
        last_fetched_at = now(),
        last_failure_at = now(),
        last_error = p_error_message,
        consecutive_errors = v_current_errors,
        backoff_until = now() + (v_backoff_mins || ' minutes')::interval,
        health_status = v_health_status,
        is_active = CASE WHEN v_should_deactivate THEN false ELSE is_active END,
        deactivated_at = CASE WHEN v_should_deactivate THEN now() ELSE deactivated_at END,
        deactivation_reason = CASE WHEN v_should_deactivate THEN 'Auto-deactivated: 5+ consecutive failures' ELSE deactivation_reason END,
        updated_at = now()
      WHERE id = p_source_id;
      
      IF v_should_deactivate THEN
        INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
        VALUES (p_source_id, 'google_news', v_source_name, 'deactivated', 'critical', v_tier, v_tags,
          jsonb_build_object('consecutive_errors', v_current_errors, 'last_error', p_error_message, 'deactivated_at', now()));
      ELSIF v_current_errors = 3 THEN
        INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
        VALUES (p_source_id, 'google_news', v_source_name, 'failing', 'warning', v_tier, v_tags,
          jsonb_build_object('consecutive_errors', v_current_errors, 'last_error', p_error_message));
      END IF;
    END IF;
  END IF;
END;
$function$;

-- 5. Create deadman check function
CREATE OR REPLACE FUNCTION public.check_source_staleness()
RETURNS TABLE(alerts_created INTEGER, stale_rss INTEGER, stale_google_news INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alerts_created INTEGER := 0;
  v_stale_rss INTEGER := 0;
  v_stale_google_news INTEGER := 0;
  v_source RECORD;
BEGIN
  FOR v_source IN
    SELECT id, name, tier, tags, expected_cadence_mins, last_success_at,
           EXTRACT(EPOCH FROM (now() - COALESCE(last_success_at, created_at))) / 60 as mins_since_success
    FROM rss_sources
    WHERE is_active = true AND expected_cadence_mins IS NOT NULL
      AND (last_success_at IS NULL OR last_success_at < now() - (expected_cadence_mins * 3 || ' minutes')::interval)
      AND id NOT IN (SELECT source_id FROM source_health_alerts WHERE source_type = 'rss' AND alert_type = 'stale' AND is_resolved = false AND created_at > now() - INTERVAL '24 hours')
  LOOP
    INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
    VALUES (v_source.id, 'rss', v_source.name, 'stale', 
      CASE WHEN v_source.mins_since_success > v_source.expected_cadence_mins * 10 THEN 'critical' ELSE 'warning' END,
      v_source.tier, v_source.tags,
      jsonb_build_object('expected_cadence_mins', v_source.expected_cadence_mins, 'mins_since_success', ROUND(v_source.mins_since_success::numeric, 0)));
    v_stale_rss := v_stale_rss + 1;
    v_alerts_created := v_alerts_created + 1;
    UPDATE rss_sources SET health_status = 'stale' WHERE id = v_source.id AND health_status NOT IN ('critical', 'failing');
  END LOOP;
  
  FOR v_source IN
    SELECT id, name, tier, tags, expected_cadence_mins, last_success_at,
           EXTRACT(EPOCH FROM (now() - COALESCE(last_success_at, created_at))) / 60 as mins_since_success
    FROM google_news_sources
    WHERE is_active = true AND expected_cadence_mins IS NOT NULL
      AND (last_success_at IS NULL OR last_success_at < now() - (expected_cadence_mins * 3 || ' minutes')::interval)
      AND id NOT IN (SELECT source_id FROM source_health_alerts WHERE source_type = 'google_news' AND alert_type = 'stale' AND is_resolved = false AND created_at > now() - INTERVAL '24 hours')
  LOOP
    INSERT INTO source_health_alerts (source_id, source_type, source_name, alert_type, severity, tier, tags, details)
    VALUES (v_source.id, 'google_news', v_source.name, 'stale', 
      CASE WHEN v_source.mins_since_success > v_source.expected_cadence_mins * 10 THEN 'critical' ELSE 'warning' END,
      v_source.tier, v_source.tags,
      jsonb_build_object('expected_cadence_mins', v_source.expected_cadence_mins, 'mins_since_success', ROUND(v_source.mins_since_success::numeric, 0)));
    v_stale_google_news := v_stale_google_news + 1;
    v_alerts_created := v_alerts_created + 1;
    UPDATE google_news_sources SET health_status = 'stale' WHERE id = v_source.id AND health_status NOT IN ('critical', 'failing');
  END LOOP;
  
  RETURN QUERY SELECT v_alerts_created, v_stale_rss, v_stale_google_news;
END;
$function$;

-- 6. Create view for stale/failing sources by tier and tag
CREATE OR REPLACE VIEW public.source_health_by_tier_tag AS
SELECT 
  source_type,
  tier,
  tag,
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE is_active = true) as active_sources,
  COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy_sources,
  COUNT(*) FILTER (WHERE health_status = 'stale') as stale_sources,
  COUNT(*) FILTER (WHERE health_status = 'failing') as failing_sources,
  COUNT(*) FILTER (WHERE health_status = 'critical') as critical_sources,
  COUNT(*) FILTER (WHERE is_active = false) as deactivated_sources
FROM (
  SELECT 'rss' as source_type, tier, unnest(COALESCE(tags, ARRAY[]::text[])) as tag, health_status, is_active FROM rss_sources
  UNION ALL
  SELECT 'google_news' as source_type, tier, unnest(COALESCE(tags, ARRAY[]::text[])) as tag, health_status, is_active FROM google_news_sources
) combined
WHERE tag IS NOT NULL AND tag != ''
GROUP BY source_type, tier, tag
ORDER BY critical_sources DESC, failing_sources DESC;

-- 7. Drop and recreate source_health_summary
DROP VIEW IF EXISTS public.source_health_summary CASCADE;

CREATE VIEW public.source_health_summary AS
SELECT 
  source_type,
  tier,
  COUNT(*) as total_sources,
  COUNT(*) FILTER (WHERE is_active = true) as active_sources,
  COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy_sources,
  COUNT(*) FILTER (WHERE health_status = 'stale') as stale_sources,
  COUNT(*) FILTER (WHERE health_status IN ('failing', 'degraded')) as failing_sources,
  COUNT(*) FILTER (WHERE health_status = 'critical') as critical_sources,
  COUNT(*) FILTER (WHERE is_active = false) as deactivated_sources
FROM (
  SELECT 'rss' as source_type, tier, is_active, health_status FROM rss_sources
  UNION ALL
  SELECT 'google_news' as source_type, tier, is_active, health_status FROM google_news_sources
) sources
GROUP BY source_type, tier
ORDER BY source_type, tier;

-- 8. Initialize health_status for existing sources
UPDATE rss_sources SET health_status = 
  CASE 
    WHEN consecutive_errors >= 5 THEN 'critical'
    WHEN consecutive_errors >= 3 THEN 'failing'
    WHEN consecutive_errors > 0 THEN 'degraded'
    WHEN last_success_at > now() - INTERVAL '24 hours' THEN 'healthy'
    WHEN last_success_at IS NOT NULL THEN 'stale'
    ELSE 'unknown'
  END;

UPDATE google_news_sources SET health_status = 
  CASE 
    WHEN consecutive_errors >= 5 THEN 'critical'
    WHEN consecutive_errors >= 3 THEN 'failing'
    WHEN consecutive_errors > 0 THEN 'degraded'
    WHEN last_success_at > now() - INTERVAL '24 hours' THEN 'healthy'
    WHEN last_success_at IS NOT NULL THEN 'stale'
    ELSE 'unknown'
  END;

-- 9. Auto-deactivate sources with 5+ consecutive errors
UPDATE rss_sources SET 
  is_active = false, deactivated_at = now(), deactivation_reason = 'Auto-deactivated: 5+ consecutive failures'
WHERE consecutive_errors >= 5 AND is_active = true;

UPDATE google_news_sources SET 
  is_active = false, deactivated_at = now(), deactivation_reason = 'Auto-deactivated: 5+ consecutive failures'
WHERE consecutive_errors >= 5 AND is_active = true;