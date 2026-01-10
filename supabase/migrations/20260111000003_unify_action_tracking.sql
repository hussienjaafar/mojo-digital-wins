-- Phase 3: Unify action tracking tables
-- Creates a bridge view that combines trend_action_outcomes with intelligence_actions/outcome_events
-- This fixes the feedback loop split where UI actions weren't feeding learning

-- First, ensure intelligence_actions has trend_event_id (it should, but verify)
ALTER TABLE public.intelligence_actions
ADD COLUMN IF NOT EXISTS trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE SET NULL;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_trend
ON public.intelligence_actions(trend_event_id)
WHERE trend_event_id IS NOT NULL;

-- Create unified view that combines both action tracking systems
-- This allows downstream consumers to read from a single source
CREATE OR REPLACE VIEW public.unified_action_outcomes AS
SELECT
  tao.id,
  tao.organization_id,
  tao.trend_event_id,
  tao.action_type,
  tao.action_taken_at AS sent_at,
  tao.outcome_type,
  tao.outcome_value,
  tao.outcome_recorded_at,
  tao.metadata,
  'trend_action_outcomes'::text AS source_table,
  te.event_title AS trend_title,
  te.entity_type,
  te.related_topics
FROM public.trend_action_outcomes tao
LEFT JOIN public.trend_events te ON te.id = tao.trend_event_id

UNION ALL

SELECT
  ia.id,
  ia.organization_id,
  ia.trend_event_id,
  ia.action_type,
  ia.sent_at,
  oe.outcome_type,
  oe.outcome_value::numeric,
  oe.recorded_at AS outcome_recorded_at,
  ia.metadata,
  'intelligence_actions'::text AS source_table,
  te.event_title AS trend_title,
  te.entity_type,
  te.related_topics
FROM public.intelligence_actions ia
LEFT JOIN public.outcome_events oe ON oe.action_id = ia.id
LEFT JOIN public.trend_events te ON te.id = ia.trend_event_id;

-- Grant access to the view
GRANT SELECT ON public.unified_action_outcomes TO authenticated;
GRANT SELECT ON public.unified_action_outcomes TO service_role;

-- Add comment
COMMENT ON VIEW public.unified_action_outcomes IS 'Unified view combining trend_action_outcomes and intelligence_actions/outcome_events for consistent learning signal computation';

-- Create a function to get action stats by trend for learning
CREATE OR REPLACE FUNCTION public.get_trend_action_stats(
  p_organization_id UUID,
  p_lookback_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  trend_event_id UUID,
  trend_title TEXT,
  entity_type TEXT,
  total_actions BIGINT,
  total_outcomes BIGINT,
  positive_outcomes BIGINT,
  total_value NUMERIC,
  success_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    uao.trend_event_id,
    MAX(uao.trend_title) AS trend_title,
    MAX(uao.entity_type) AS entity_type,
    COUNT(*) AS total_actions,
    COUNT(uao.outcome_type) FILTER (WHERE uao.outcome_type IS NOT NULL) AS total_outcomes,
    COUNT(*) FILTER (WHERE uao.outcome_type IN ('donation', 'conversion', 'signup', 'click')) AS positive_outcomes,
    COALESCE(SUM(uao.outcome_value) FILTER (WHERE uao.outcome_value > 0), 0) AS total_value,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE uao.outcome_type IN ('donation', 'conversion', 'signup', 'click'))::NUMERIC
        / COUNT(*)::NUMERIC * 100, 2
      )
      ELSE 0
    END AS success_rate
  FROM public.unified_action_outcomes uao
  WHERE uao.organization_id = p_organization_id
    AND uao.sent_at >= NOW() - (p_lookback_days || ' days')::INTERVAL
    AND uao.trend_event_id IS NOT NULL
  GROUP BY uao.trend_event_id
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_trend_action_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trend_action_stats TO service_role;
