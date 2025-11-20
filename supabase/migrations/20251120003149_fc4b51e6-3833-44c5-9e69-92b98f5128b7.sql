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

-- Fix RLS policies for daily briefing access
-- The 406 error means RLS is blocking access even though policies exist

-- Drop and recreate policies to ensure they work
DROP POLICY IF EXISTS "Anyone can view briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Admins can manage briefings" ON public.daily_briefings;
DROP POLICY IF EXISTS "Authenticated users can view briefings" ON public.daily_briefings;

-- Create clear, simple policies
CREATE POLICY "Authenticated users can view briefings"
  ON public.daily_briefings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage briefings"
  ON public.daily_briefings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for breaking news clusters
DROP POLICY IF EXISTS "Anyone can view breaking news" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Admins can manage breaking news" ON public.breaking_news_clusters;
DROP POLICY IF EXISTS "Authenticated users can view breaking news" ON public.breaking_news_clusters;

CREATE POLICY "Authenticated users can view breaking news"
  ON public.breaking_news_clusters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage breaking news"
  ON public.breaking_news_clusters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for organization mentions
DROP POLICY IF EXISTS "Anyone can view org mentions" ON public.organization_mentions;
DROP POLICY IF EXISTS "Admins can manage org mentions" ON public.organization_mentions;
DROP POLICY IF EXISTS "Authenticated users can view org mentions" ON public.organization_mentions;

CREATE POLICY "Authenticated users can view org mentions"
  ON public.organization_mentions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage org mentions"
  ON public.organization_mentions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.daily_briefings IS
'Daily intelligence briefings with RLS policies allowing authenticated users to read.';