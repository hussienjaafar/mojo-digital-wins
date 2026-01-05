
-- ============================================================================
-- Task 5: Action Instrumentation Tables
-- ============================================================================

-- Create intelligence_actions table
CREATE TABLE IF NOT EXISTS public.intelligence_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_status TEXT NOT NULL DEFAULT 'pending',
  trend_event_id UUID,
  suggested_action_id UUID,
  alert_id UUID,
  sms_message_id TEXT,
  meta_creative_id TEXT,
  meta_adset_id TEXT,
  meta_campaign_id TEXT,
  audience_id TEXT,
  copy_text TEXT,
  copy_variant TEXT,
  entity_name TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_intelligence_actions_org ON public.intelligence_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_trend ON public.intelligence_actions(trend_event_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_actions_sent ON public.intelligence_actions(sent_at);

ALTER TABLE public.intelligence_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_actions" ON public.intelligence_actions;
CREATE POLICY "org_members_read_actions" ON public.intelligence_actions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.id = auth.uid() AND cu.organization_id = intelligence_actions.organization_id)
  );

DROP POLICY IF EXISTS "service_role_manage_actions" ON public.intelligence_actions;
CREATE POLICY "service_role_manage_actions" ON public.intelligence_actions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- Create outcome_events table
CREATE TABLE IF NOT EXISTS public.outcome_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  action_id UUID REFERENCES public.intelligence_actions(id) ON DELETE SET NULL,
  outcome_type TEXT NOT NULL,
  sms_message_id TEXT,
  meta_creative_id TEXT,
  meta_campaign_id TEXT,
  transaction_id TEXT,
  outcome_value DECIMAL(12,2),
  outcome_count INTEGER DEFAULT 1,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  attributed BOOLEAN DEFAULT false,
  attribution_confidence DECIMAL(5,2),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_outcome_events_org ON public.outcome_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_action ON public.outcome_events(action_id);
CREATE INDEX IF NOT EXISTS idx_outcome_events_type ON public.outcome_events(outcome_type);
CREATE INDEX IF NOT EXISTS idx_outcome_events_occurred ON public.outcome_events(occurred_at);

ALTER TABLE public.outcome_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_outcomes" ON public.outcome_events;
CREATE POLICY "org_members_read_outcomes" ON public.outcome_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.id = auth.uid() AND cu.organization_id = outcome_events.organization_id)
  );

DROP POLICY IF EXISTS "service_role_manage_outcomes" ON public.outcome_events;
CREATE POLICY "service_role_manage_outcomes" ON public.outcome_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- Create action_outcome_summary view
CREATE OR REPLACE VIEW public.action_outcome_summary AS
SELECT 
  ia.organization_id,
  ia.id AS action_id,
  ia.action_type,
  ia.trend_event_id,
  ia.entity_name,
  ia.copy_variant,
  ia.sent_at,
  COUNT(DISTINCT oe.id) AS total_outcomes,
  COUNT(DISTINCT CASE WHEN oe.outcome_type LIKE 'sms_%' THEN oe.id END) AS sms_outcomes,
  COUNT(DISTINCT CASE WHEN oe.outcome_type LIKE 'meta_%' THEN oe.id END) AS meta_outcomes,
  COUNT(DISTINCT CASE WHEN oe.outcome_type = 'donation' THEN oe.id END) AS donation_count,
  COALESCE(SUM(CASE WHEN oe.outcome_type = 'donation' THEN oe.outcome_value END), 0) AS donation_total
FROM public.intelligence_actions ia
LEFT JOIN public.outcome_events oe ON oe.action_id = ia.id
GROUP BY ia.id, ia.organization_id, ia.action_type, ia.trend_event_id, ia.entity_name, ia.copy_variant, ia.sent_at;


-- Create trend_outcome_correlation table
CREATE TABLE IF NOT EXISTS public.trend_outcome_correlation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID,
  trend_key TEXT NOT NULL,
  actions_sent INTEGER DEFAULT 0,
  total_outcomes INTEGER DEFAULT 0,
  total_donations INTEGER DEFAULT 0,
  total_donation_amount DECIMAL(12,2) DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2),
  donation_rate DECIMAL(5,2),
  avg_donation DECIMAL(10,2),
  baseline_response_rate DECIMAL(5,2),
  performance_delta DECIMAL(5,2),
  should_boost_relevance BOOLEAN DEFAULT false,
  learning_signal TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  UNIQUE(organization_id, trend_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_trend_outcome_corr_org ON public.trend_outcome_correlation(organization_id);

ALTER TABLE public.trend_outcome_correlation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_correlations" ON public.trend_outcome_correlation;
CREATE POLICY "org_members_read_correlations" ON public.trend_outcome_correlation
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.id = auth.uid() AND cu.organization_id = trend_outcome_correlation.organization_id)
  );

DROP POLICY IF EXISTS "service_role_manage_correlations" ON public.trend_outcome_correlation;
CREATE POLICY "service_role_manage_correlations" ON public.trend_outcome_correlation
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
