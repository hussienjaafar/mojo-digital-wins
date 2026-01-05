-- Create org_trend_scores table for per-org relevance + explainability
CREATE TABLE IF NOT EXISTS public.org_trend_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE CASCADE,
  trend_cluster_id UUID, -- Fallback if using old clusters
  trend_key TEXT NOT NULL, -- e.g., normalized topic name
  relevance_score INTEGER NOT NULL DEFAULT 0,
  urgency_score INTEGER NOT NULL DEFAULT 0,
  priority_bucket TEXT DEFAULT 'low' CHECK (priority_bucket IN ('high', 'medium', 'low')),
  is_blocked BOOLEAN DEFAULT false,
  is_allowlisted BOOLEAN DEFAULT false,
  matched_topics TEXT[] DEFAULT '{}',
  matched_entities TEXT[] DEFAULT '{}',
  matched_geographies TEXT[] DEFAULT '{}',
  explanation JSONB DEFAULT '{}', -- Detailed breakdown of scoring
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  UNIQUE(organization_id, trend_key)
);

CREATE INDEX IF NOT EXISTS idx_org_trend_scores_org ON public.org_trend_scores(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_trend_scores_priority ON public.org_trend_scores(organization_id, priority_bucket);
CREATE INDEX IF NOT EXISTS idx_org_trend_scores_expires ON public.org_trend_scores(expires_at);

-- RLS for org_trend_scores
ALTER TABLE public.org_trend_scores ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's trend scores
CREATE POLICY "org_members_read_trend_scores" ON public.org_trend_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.id = auth.uid()
        AND cu.organization_id = org_trend_scores.organization_id
    )
  );

-- Service role can manage all (for edge functions)
CREATE POLICY "service_role_manage_trend_scores" ON public.org_trend_scores
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create SQL function to get org relevance
CREATE OR REPLACE FUNCTION public.get_org_trend_relevance(
  p_organization_id UUID,
  p_min_score INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  trend_key TEXT,
  trend_event_id UUID,
  relevance_score INTEGER,
  urgency_score INTEGER,
  priority_bucket TEXT,
  matched_topics TEXT[],
  matched_entities TEXT[],
  explanation JSONB
) 
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    trend_key,
    trend_event_id,
    relevance_score,
    urgency_score,
    priority_bucket,
    matched_topics,
    matched_entities,
    explanation
  FROM public.org_trend_scores
  WHERE organization_id = p_organization_id
    AND is_blocked = false
    AND expires_at > now()
    AND relevance_score >= p_min_score
  ORDER BY 
    CASE priority_bucket 
      WHEN 'high' THEN 1 
      WHEN 'medium' THEN 2 
      ELSE 3 
    END,
    relevance_score DESC
  LIMIT p_limit;
$$;

-- Create security-invoker view for org relevant trends
CREATE VIEW public.org_relevant_trends 
WITH (security_invoker = true)
AS
SELECT 
  ots.organization_id,
  ots.trend_key,
  ots.relevance_score,
  ots.priority_bucket,
  ots.matched_topics,
  ots.explanation,
  te.event_title,
  te.velocity,
  te.is_trending,
  te.is_breaking,
  te.confidence_score,
  te.current_1h,
  te.current_6h,
  te.current_24h
FROM public.org_trend_scores ots
LEFT JOIN public.trend_events te ON ots.trend_event_id = te.id
WHERE ots.is_blocked = false
  AND ots.expires_at > now();