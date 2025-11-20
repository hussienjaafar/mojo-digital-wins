-- Fix get_briefing_stats function to handle NULL cases properly
-- and add better error handling

CREATE OR REPLACE FUNCTION public.get_briefing_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  start_time TIMESTAMPTZ;
  articles_stats JSONB;
  bills_stats JSONB;
  exec_orders_stats JSONB;
  state_actions_stats JSONB;
BEGIN
  -- Look at last 24 hours instead of just calendar date
  start_time := NOW() - INTERVAL '24 hours';

  -- Get articles stats (with NULL handling)
  SELECT COALESCE(jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
    'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
    'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
    'low', COUNT(*) FILTER (WHERE threat_level = 'low')
  ), '{"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}'::jsonb)
  INTO articles_stats
  FROM public.articles
  WHERE published_date >= start_time;

  -- Get bills stats (with NULL handling)
  SELECT COALESCE(jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
    'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
    'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
    'low', COUNT(*) FILTER (WHERE threat_level = 'low')
  ), '{"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}'::jsonb)
  INTO bills_stats
  FROM public.bills
  WHERE latest_action_date >= start_time OR introduced_date >= start_time;

  -- Get executive orders stats (with NULL handling)
  SELECT COALESCE(jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
    'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
    'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
    'low', COUNT(*) FILTER (WHERE threat_level = 'low')
  ), '{"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}'::jsonb)
  INTO exec_orders_stats
  FROM public.executive_orders
  WHERE signing_date >= start_time;

  -- Get state actions stats (with NULL handling)
  SELECT COALESCE(jsonb_build_object(
    'total', COUNT(*),
    'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
    'high', COUNT(*) FILTER (WHERE threat_level = 'high'),
    'medium', COUNT(*) FILTER (WHERE threat_level = 'medium'),
    'low', COUNT(*) FILTER (WHERE threat_level = 'low')
  ), '{"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}'::jsonb)
  INTO state_actions_stats
  FROM public.state_actions
  WHERE action_date >= start_time;

  -- Build final result
  result := jsonb_build_object(
    'articles', articles_stats,
    'bills', bills_stats,
    'executive_orders', exec_orders_stats,
    'state_actions', state_actions_stats
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, return a valid empty stats object instead of NULL
    RETURN '{"articles": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}, "bills": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}, "executive_orders": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}, "state_actions": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0}}'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_briefing_stats(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_briefing_stats(DATE) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.get_briefing_stats IS 'Get briefing statistics for the last 24 hours, broken down by content type and threat level';
