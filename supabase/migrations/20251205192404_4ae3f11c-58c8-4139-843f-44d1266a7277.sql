-- Phase 7: System Health Monitoring Function
CREATE OR REPLACE FUNCTION public.get_system_health_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'jobs', (
      SELECT jsonb_build_object(
        'active_count', COUNT(*) FILTER (WHERE is_active = true),
        'failed_last_hour', COUNT(*) FILTER (WHERE last_run_status = 'failed' AND last_run_at > NOW() - INTERVAL '1 hour'),
        'circuit_breakers_open', COUNT(*) FILTER (WHERE is_circuit_open = true),
        'avg_duration_ms', ROUND(AVG(last_run_duration_ms) FILTER (WHERE last_run_at > NOW() - INTERVAL '1 hour'))
      )
      FROM scheduled_jobs
    ),
    'data_freshness', (
      SELECT jsonb_build_object(
        'articles_last_hour', COUNT(*) FILTER (WHERE published_date > NOW() - INTERVAL '1 hour'),
        'bluesky_posts_24h', COUNT(*),
        'last_article_mins_ago', EXTRACT(EPOCH FROM (NOW() - MAX(published_date))) / 60
      )
      FROM articles WHERE published_date > NOW() - INTERVAL '24 hours'
    ),
    'alerts', (
      SELECT jsonb_build_object(
        'pending_count', COUNT(*) FILTER (WHERE status = 'pending'),
        'sent_last_hour', COUNT(*) FILTER (WHERE status = 'sent' AND sent_at > NOW() - INTERVAL '1 hour'),
        'throttle_rate', ROUND((COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '4 hours'))::numeric / NULLIF(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '8 hours'), 0) * 100, 1)
      )
      FROM alert_queue
    ),
    'cache', (
      SELECT jsonb_build_object(
        'total_entries', COUNT(*),
        'avg_hit_rate', ROUND(AVG(hit_count)::numeric, 1),
        'cache_size_mb', ROUND(pg_total_relation_size('ai_analysis_cache')::numeric / 1024 / 1024, 2)
      )
      FROM ai_analysis_cache
    ),
    'database', (
      SELECT jsonb_build_object(
        'bluesky_posts_count', (SELECT COUNT(*) FROM bluesky_posts),
        'articles_count', (SELECT COUNT(*) FROM articles),
        'anomalies_24h', (SELECT COUNT(*) FROM trend_anomalies WHERE detected_at > NOW() - INTERVAL '24 hours')
      )
    ),
    'optimization_status', jsonb_build_object(
      'job_tiers', (SELECT COUNT(DISTINCT schedule) FROM scheduled_jobs WHERE is_active = true),
      'dependency_tracking', true,
      'smart_skip_enabled', true,
      'alert_throttling_hours', 4,
      'batch_processing', true
    ),
    'generated_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;