-- Phase 7 Critical Fixes

-- 1. Update client_entity_alerts check constraint to allow all alert types
ALTER TABLE public.client_entity_alerts DROP CONSTRAINT IF EXISTS client_entity_alerts_alert_type_check;
ALTER TABLE public.client_entity_alerts ADD CONSTRAINT client_entity_alerts_alert_type_check 
  CHECK (alert_type = ANY (ARRAY[
    'spike'::text, 
    'breaking'::text, 
    'sentiment_shift'::text, 
    'opposition_mention'::text,
    'trending_spike'::text,
    'volume_spike'::text,
    'breaking_trend'::text,
    'cross_source_breakthrough'::text,
    'velocity_anomaly'::text,
    'mention_anomaly'::text
  ]));

-- 2. Add unique constraint on state_actions source_url
CREATE UNIQUE INDEX IF NOT EXISTS idx_state_actions_source_url ON public.state_actions(source_url) WHERE source_url IS NOT NULL;

-- 3. Create client_onboarding_status table
CREATE TABLE IF NOT EXISTS public.client_onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_completed TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(organization_id, user_id, step_completed)
);

ALTER TABLE public.client_onboarding_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org onboarding" ON public.client_onboarding_status
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert own org onboarding" ON public.client_onboarding_status
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage all onboarding" ON public.client_onboarding_status
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create magic_moment_cards table
CREATE TABLE IF NOT EXISTS public.magic_moment_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  card_type TEXT NOT NULL DEFAULT 'insight',
  priority TEXT DEFAULT 'medium',
  action_url TEXT,
  action_label TEXT,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.magic_moment_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org cards" ON public.magic_moment_cards
  FOR SELECT USING (organization_id = get_user_organization_id() AND is_dismissed = false);

CREATE POLICY "Users can update own org cards" ON public.magic_moment_cards
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage all cards" ON public.magic_moment_cards
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.trend_anomalies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_group_sentiment;
ALTER PUBLICATION supabase_realtime ADD TABLE public.magic_moment_cards;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_magic_moment_cards_org ON public.magic_moment_cards(organization_id, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_client_onboarding_org ON public.client_onboarding_status(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trend_anomalies_unacked ON public.trend_anomalies(is_acknowledged, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_group_sentiment_date ON public.daily_group_sentiment(date DESC, affected_group);