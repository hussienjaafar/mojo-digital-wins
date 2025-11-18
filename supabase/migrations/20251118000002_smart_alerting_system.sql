-- Phase 2: Smart Alerting System
-- Implements priority scoring, breaking news detection, and daily briefings

-- =============================================================================
-- 1. BREAKING NEWS CLUSTERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.breaking_news_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_topic TEXT NOT NULL,
  article_count INTEGER DEFAULT 0,
  source_names TEXT[] DEFAULT '{}',
  first_detected_at TIMESTAMPTZ DEFAULT now(),
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  threat_level TEXT DEFAULT 'medium',
  affected_organizations TEXT[] DEFAULT '{}',
  primary_article_id UUID REFERENCES public.articles(id),
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. ORGANIZATION MENTIONS TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organization_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_name TEXT NOT NULL,
  organization_abbrev TEXT NOT NULL,
  source_type TEXT NOT NULL, -- article, bill, executive_order, state_action
  source_id UUID NOT NULL,
  source_title TEXT NOT NULL,
  mention_context TEXT, -- Surrounding text of the mention
  sentiment TEXT, -- positive, negative, neutral
  threat_level TEXT DEFAULT 'low',
  mentioned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. DAILY BRIEFINGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date DATE NOT NULL UNIQUE,

  -- Summary stats
  total_articles INTEGER DEFAULT 0,
  total_bills INTEGER DEFAULT 0,
  total_executive_orders INTEGER DEFAULT 0,
  total_state_actions INTEGER DEFAULT 0,

  -- Threat counts
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,

  -- Key items (IDs)
  top_critical_items JSONB DEFAULT '[]'::jsonb,
  breaking_news_clusters UUID[] DEFAULT '{}',
  organization_mentions JSONB DEFAULT '[]'::jsonb,

  -- AI-generated content
  executive_summary TEXT,
  key_takeaways TEXT[],
  recommended_actions TEXT[],

  -- Metadata
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. ALERT RULES (User-configurable)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- keyword, organization, threat_level, source_type
  rule_value TEXT NOT NULL, -- The keyword, org name, threat level, or source type
  notification_channels TEXT[] DEFAULT '{in_app}'::text[], -- in_app, email, sms
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. ALERT QUEUE (For processing)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.alert_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- breaking_news, critical_item, org_mention, keyword_match
  priority TEXT NOT NULL, -- critical, high, medium, low
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  target_users UUID[] DEFAULT '{}', -- Empty = all users
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. UPDATE USER PREFERENCES FOR ALERTS
-- =============================================================================
ALTER TABLE public.user_article_preferences
ADD COLUMN IF NOT EXISTS alert_threshold TEXT DEFAULT 'high', -- critical, high, medium, low
ADD COLUMN IF NOT EXISTS breaking_news_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS organization_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_briefing_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS daily_briefing_time TIME DEFAULT '08:00:00',
ADD COLUMN IF NOT EXISTS immediate_critical_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS watched_organizations TEXT[] DEFAULT '{CAIR,MPAC,ISNA,ADC,AAI}'::text[];

-- =============================================================================
-- 7. INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_breaking_news_active ON public.breaking_news_clusters(is_active, first_detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_mentions_org ON public.organization_mentions(organization_abbrev, mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_mentions_source ON public.organization_mentions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_date ON public.daily_briefings(briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON public.alert_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_queue_unprocessed ON public.alert_queue(processed, priority, created_at);

-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.breaking_news_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_queue ENABLE ROW LEVEL SECURITY;

-- Public read for general data
CREATE POLICY "Anyone can view breaking news" ON public.breaking_news_clusters FOR SELECT USING (true);
CREATE POLICY "Anyone can view org mentions" ON public.organization_mentions FOR SELECT USING (true);
CREATE POLICY "Anyone can view briefings" ON public.daily_briefings FOR SELECT USING (true);

-- User-specific alert rules
CREATE POLICY "Users can view own rules" ON public.alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own rules" ON public.alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rules" ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rules" ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

-- Admin write access
CREATE POLICY "Admins can manage breaking news" ON public.breaking_news_clusters FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage org mentions" ON public.organization_mentions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage briefings" ON public.daily_briefings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage alert queue" ON public.alert_queue FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- 9. FUNCTION: Get Today's Briefing Data
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_briefing_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'articles', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high')
      )
      FROM public.articles
      WHERE DATE(published_date) = target_date
    ),
    'bills', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high')
      )
      FROM public.bills
      WHERE DATE(introduced_date) = target_date OR DATE(latest_action_date) = target_date
    ),
    'executive_orders', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high')
      )
      FROM public.executive_orders
      WHERE DATE(signing_date) = target_date
    ),
    'state_actions', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'critical', COUNT(*) FILTER (WHERE threat_level = 'critical'),
        'high', COUNT(*) FILTER (WHERE threat_level = 'high')
      )
      FROM public.state_actions
      WHERE action_date = target_date
    ),
    'breaking_news', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'topic', cluster_topic,
        'article_count', article_count,
        'sources', source_names,
        'threat_level', threat_level
      )), '[]'::jsonb)
      FROM public.breaking_news_clusters
      WHERE DATE(first_detected_at) = target_date AND is_active = true
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
