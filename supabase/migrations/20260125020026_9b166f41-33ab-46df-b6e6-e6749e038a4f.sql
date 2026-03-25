-- =========================================================
-- Creative Intelligence 2.0: Add Missing Tables
-- =========================================================

-- Table 1: Store discovered correlations between creative attributes and outcomes
CREATE TABLE IF NOT EXISTS public.creative_performance_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  correlation_type TEXT NOT NULL,
  attribute_name TEXT NOT NULL,
  attribute_value TEXT NOT NULL,
  correlated_metric TEXT NOT NULL,
  correlation_coefficient NUMERIC,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence_level NUMERIC,
  p_value NUMERIC,
  insight_text TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_actionable BOOLEAN DEFAULT FALSE,
  recommended_action TEXT,
  metric_avg_with_attribute NUMERIC,
  metric_avg_without_attribute NUMERIC,
  lift_percentage NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: Track ad fatigue and decay patterns
CREATE TABLE IF NOT EXISTS public.ad_fatigue_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  creative_id UUID,
  baseline_ctr NUMERIC,
  current_ctr NUMERIC,
  decline_percent NUMERIC,
  days_declining INTEGER DEFAULT 0,
  decline_start_date DATE,
  predicted_exhaustion_date DATE,
  alert_severity TEXT CHECK (alert_severity IN ('watch', 'warning', 'critical')) DEFAULT 'watch',
  total_spend_at_detection NUMERIC,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolution_action TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_creative_correlations_org ON public.creative_performance_correlations(organization_id);
CREATE INDEX IF NOT EXISTS idx_creative_correlations_actionable ON public.creative_performance_correlations(is_actionable) WHERE is_actionable = true;

CREATE INDEX IF NOT EXISTS idx_ad_fatigue_org ON public.ad_fatigue_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_fatigue_active ON public.ad_fatigue_alerts(organization_id, is_acknowledged) WHERE is_acknowledged = false;

-- Enable RLS
ALTER TABLE public.creative_performance_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_fatigue_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their org correlations" ON public.creative_performance_correlations
  FOR SELECT USING (
    public.user_belongs_to_organization(organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    organization_id IS NULL
  );

CREATE POLICY "Users can view their org fatigue alerts" ON public.ad_fatigue_alerts
  FOR SELECT USING (
    public.user_belongs_to_organization(organization_id) OR
    public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Service role can manage correlations" ON public.creative_performance_correlations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage fatigue alerts" ON public.ad_fatigue_alerts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');