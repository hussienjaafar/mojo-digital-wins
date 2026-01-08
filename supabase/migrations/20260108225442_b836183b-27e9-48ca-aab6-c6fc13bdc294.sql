-- Phase 3: Learning Loop - Create trend action outcomes table for feedback tracking
CREATE TABLE public.trend_action_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_event_id UUID REFERENCES public.trend_events(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('sms', 'email', 'alert', 'watchlist', 'dismiss', 'share')),
  action_taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome_type TEXT CHECK (outcome_type IN ('donation', 'click', 'signup', 'conversion', 'engagement', 'none')),
  outcome_value NUMERIC DEFAULT 0,
  outcome_recorded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add decision score columns to trend_events
ALTER TABLE public.trend_events 
ADD COLUMN IF NOT EXISTS decision_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS opportunity_tier TEXT CHECK (opportunity_tier IN ('act_now', 'consider', 'watch', 'ignore'));

-- Enable RLS
ALTER TABLE public.trend_action_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS policies for trend_action_outcomes
CREATE POLICY "Users can view their organization's action outcomes"
ON public.trend_action_outcomes
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.client_users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert action outcomes for their organization"
ON public.trend_action_outcomes
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.client_users WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all action outcomes"
ON public.trend_action_outcomes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.client_users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Index for performance
CREATE INDEX idx_trend_action_outcomes_trend ON public.trend_action_outcomes(trend_event_id);
CREATE INDEX idx_trend_action_outcomes_org ON public.trend_action_outcomes(organization_id);
CREATE INDEX idx_trend_action_outcomes_type ON public.trend_action_outcomes(action_type);
CREATE INDEX idx_trend_events_decision_score ON public.trend_events(decision_score DESC NULLS LAST);