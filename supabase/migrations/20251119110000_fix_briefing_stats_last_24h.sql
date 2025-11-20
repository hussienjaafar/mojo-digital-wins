-- Fix get_briefing_stats to look at last 24 hours instead of just today
-- This ensures the daily briefing shows data even if articles haven't been published yet today

CREATE OR REPLACE FUNCTION public.get_briefing_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  start_time TIMESTAMPTZ;
BEGIN
  -- Look at last 24 hours instead of just calendar date
  start_time := NOW() - INTERVAL '24 hours';

  SELECT jsonb_build_object(
    'articles', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
        'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
        'low', COUNT(*) FILTER (WHERE threat_level = 'low')
      )
      FROM public.articles
      WHERE published_date >= start_time
    ),
    'bills', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
        'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
        'low', COUNT(*) FILTER (WHERE threat_level = 'low')
      )
      FROM public.bills
      WHERE latest_action_date >= start_time OR introduced_date >= start_time
    ),
    'executive_orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
        'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
        'low', COUNT(*) FILTER (WHERE threat_level = 'low')
      )
      FROM public.executive_orders
      WHERE signing_date >= start_time
    ),
    'state_actions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
        'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
        'low', COUNT(*) FILTER (WHERE threat_level = 'low')
      )
      FROM public.state_actions
      WHERE action_date >= start_time
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_briefing_stats IS
'Get briefing statistics for the last 24 hours instead of just today.
This ensures the daily briefing shows data even if no new items have been published yet today.';
