-- Migration 2: Smart Alerting System
-- Creates breaking_news_clusters, organization_mentions, daily_briefings, alert_rules, alert_queue tables

-- Breaking News Clusters table
CREATE TABLE IF NOT EXISTS public.breaking_news_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  threat_level INTEGER DEFAULT 0,
  article_ids UUID[] DEFAULT '{}',
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  key_entities TEXT[] DEFAULT '{}',
  geographic_scope TEXT[] DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization Mentions table
CREATE TABLE IF NOT EXISTS public.organization_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  mention_context TEXT NOT NULL,
  sentiment TEXT,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  mentioned_at TIMESTAMPTZ NOT NULL,
  relevance_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily Briefings table
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date DATE NOT NULL UNIQUE,
  overall_threat_score INTEGER DEFAULT 0,
  top_threats JSONB DEFAULT '[]',
  key_developments JSONB DEFAULT '[]',
  organization_mentions_summary JSONB DEFAULT '{}',
  executive_orders_summary JSONB DEFAULT '[]',
  state_actions_summary JSONB DEFAULT '[]',
  recommendations TEXT[] DEFAULT '{}',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert Rules table
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  notification_channels TEXT[] DEFAULT '{"email"}',
  recipient_emails TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert Queue table
CREATE TABLE IF NOT EXISTS public.alert_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  triggered_by_rule UUID REFERENCES public.alert_rules(id),
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.breaking_news_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view breaking news clusters"
  ON public.breaking_news_clusters FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage breaking news clusters"
  ON public.breaking_news_clusters FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view organization mentions"
  ON public.organization_mentions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage organization mentions"
  ON public.organization_mentions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view daily briefings"
  ON public.daily_briefings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage daily briefings"
  ON public.daily_briefings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all alert rules"
  ON public.alert_rules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage alert rules"
  ON public.alert_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view alert queue"
  ON public.alert_queue FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage alert queue"
  ON public.alert_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_breaking_news_severity ON public.breaking_news_clusters(severity, first_detected_at DESC);
CREATE INDEX idx_breaking_news_resolved ON public.breaking_news_clusters(is_resolved, last_updated_at DESC);
CREATE INDEX idx_org_mentions_date ON public.organization_mentions(mentioned_at DESC);
CREATE INDEX idx_org_mentions_name ON public.organization_mentions(organization_name);
CREATE INDEX idx_daily_briefings_date ON public.daily_briefings(briefing_date DESC);
CREATE INDEX idx_alert_rules_active ON public.alert_rules(is_active);
CREATE INDEX idx_alert_queue_status ON public.alert_queue(status, created_at DESC);