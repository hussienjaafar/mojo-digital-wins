-- Create event_impact_correlations table
CREATE TABLE IF NOT EXISTS public.event_impact_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  donations_48h_after INTEGER NOT NULL DEFAULT 0,
  amount_raised_48h_after NUMERIC NOT NULL DEFAULT 0,
  avg_donation_48h_after NUMERIC NOT NULL DEFAULT 0,
  baseline_donations INTEGER NOT NULL DEFAULT 0,
  baseline_amount NUMERIC NOT NULL DEFAULT 0,
  baseline_avg_donation NUMERIC NOT NULL DEFAULT 0,
  correlation_strength NUMERIC NOT NULL DEFAULT 0,
  topic_velocity NUMERIC,
  topic_mentions INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, entity_name, event_date)
);

-- Create fundraising_opportunities table
CREATE TABLE IF NOT EXISTS public.fundraising_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  opportunity_score NUMERIC NOT NULL,
  velocity NUMERIC,
  current_mentions INTEGER,
  time_sensitivity NUMERIC,
  estimated_value NUMERIC,
  historical_success_rate NUMERIC,
  similar_past_events INTEGER DEFAULT 0,
  sample_sources JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, entity_name)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_event_impact_org_entity ON public.event_impact_correlations(organization_id, entity_name);
CREATE INDEX IF NOT EXISTS idx_event_impact_date ON public.event_impact_correlations(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_fundraising_opp_org_active ON public.fundraising_opportunities(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fundraising_opp_score ON public.fundraising_opportunities(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_fundraising_opp_expires ON public.fundraising_opportunities(expires_at);

-- Enable RLS
ALTER TABLE public.event_impact_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundraising_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_impact_correlations
CREATE POLICY "Admin users can view all correlations" ON public.event_impact_correlations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their org correlations" ON public.event_impact_correlations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- RLS Policies for fundraising_opportunities
CREATE POLICY "Admin users can view all opportunities" ON public.fundraising_opportunities
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Client users can view their org opportunities" ON public.fundraising_opportunities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Auto-update updated_at timestamp
CREATE TRIGGER update_fundraising_opportunities_updated_at
  BEFORE UPDATE ON public.fundraising_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();