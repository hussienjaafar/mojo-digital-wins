-- ============================================================================
-- NEWS & TRENDS V2 - COMBINED MIGRATION (FIXED)
-- ============================================================================

-- ============================================================================
-- 1. RSS SOURCES - ADD POLICY DOMAINS
-- ============================================================================

ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS policy_domains TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_rss_sources_domains ON rss_sources USING GIN(policy_domains);

-- ============================================================================
-- 2. TREND EVENTS - ADD V2 TAGGING FIELDS
-- ============================================================================

ALTER TABLE trend_events
ADD COLUMN IF NOT EXISTS policy_domains TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS geographies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS geo_level TEXT DEFAULT 'national',
ADD COLUMN IF NOT EXISTS politicians_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS organizations_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS legislation_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evidence_by_domain JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS priority_bucket TEXT DEFAULT 'MEDIUM';

CREATE INDEX IF NOT EXISTS idx_trend_events_domains ON trend_events USING GIN(policy_domains);
CREATE INDEX IF NOT EXISTS idx_trend_events_geos ON trend_events USING GIN(geographies);

-- ============================================================================
-- 3. ORG TOPIC AFFINITIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_topic_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  affinity_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  times_used INTEGER DEFAULT 0,
  avg_performance DECIMAL(6,2) DEFAULT 0,
  best_performance DECIMAL(6,2) DEFAULT -100,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'learned_outcome',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, topic)
);

ALTER TABLE org_topic_affinities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to org_topic_affinities"
ON org_topic_affinities FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Org members can view own affinities"
ON org_topic_affinities FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_affinities_org ON org_topic_affinities(organization_id);
CREATE INDEX IF NOT EXISTS idx_affinities_score ON org_topic_affinities(organization_id, affinity_score DESC);

-- ============================================================================
-- 4. ORG TREND RELEVANCE CACHE
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_trend_relevance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL,
  relevance_reasons JSONB DEFAULT '[]',
  relevance_flags TEXT[] DEFAULT '{}',
  is_new_opportunity BOOLEAN DEFAULT false,
  is_proven_topic BOOLEAN DEFAULT false,
  matched_domains TEXT[] DEFAULT '{}',
  matched_watchlist TEXT[] DEFAULT '{}',
  priority_bucket TEXT DEFAULT 'low',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, trend_event_id)
);

ALTER TABLE org_trend_relevance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to org_trend_relevance_cache"
ON org_trend_relevance_cache FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Org members can view own relevance cache"
ON org_trend_relevance_cache FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_org_trend_cache_lookup
  ON org_trend_relevance_cache(organization_id, relevance_score DESC);

-- ============================================================================
-- 5. CAMPAIGN TOPIC EXTRACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_topic_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL,
  extracted_topics TEXT[] DEFAULT '{}',
  policy_domains TEXT[] DEFAULT '{}',
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id)
);

ALTER TABLE campaign_topic_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to campaign_topic_extractions"
ON campaign_topic_extractions FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Org members can view own campaign extractions"
ON campaign_topic_extractions FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_campaign_extractions_org ON campaign_topic_extractions(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_topic_extractions_campaign_type ON campaign_topic_extractions(campaign_type);

-- ============================================================================
-- 6. TREND CAMPAIGN CORRELATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS trend_campaign_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  correlation_score DECIMAL(4,3) NOT NULL,
  domain_overlap TEXT[] DEFAULT '{}',
  topic_overlap TEXT[] DEFAULT '{}',
  time_delta_hours INTEGER,
  campaign_performance JSONB DEFAULT '{}',
  performance_vs_baseline DECIMAL(6,2),
  outcome_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trend_campaign_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to trend_campaign_correlations"
ON trend_campaign_correlations FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Org members can view own correlations"
ON trend_campaign_correlations FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_correlations_org ON trend_campaign_correlations(organization_id);
CREATE INDEX IF NOT EXISTS idx_correlations_trend ON trend_campaign_correlations(trend_event_id);

-- ============================================================================
-- 7. TREND FILTER LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS trend_filter_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  user_id UUID,
  request_at TIMESTAMPTZ DEFAULT NOW(),
  filters_applied JSONB DEFAULT '{}',
  total_trends_available INTEGER,
  trends_shown INTEGER,
  domains_shown TEXT[] DEFAULT '{}',
  domains_filtered_out TEXT[] DEFAULT '{}',
  new_opportunity_count INTEGER DEFAULT 0
);

ALTER TABLE trend_filter_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to trend_filter_log"
ON trend_filter_log FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own org filter logs"
ON trend_filter_log FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_filter_log_org ON trend_filter_log(organization_id, request_at DESC);

-- ============================================================================
-- 8. SYSTEM BASELINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL UNIQUE,
  baseline_value NUMERIC NOT NULL DEFAULT 0.05,
  calculation_method TEXT DEFAULT 'rolling_30_day',
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to system_baselines"
ON system_baselines FOR ALL
USING (auth.role() = 'service_role');

INSERT INTO system_baselines (metric_name, baseline_value, calculation_method)
VALUES
  ('campaign_performance', 0.05, 'rolling_30_day'),
  ('sms_performance', 0.08, 'rolling_30_day'),
  ('email_performance', 0.05, 'rolling_30_day'),
  ('push_performance', 0.03, 'rolling_30_day'),
  ('social_performance', 0.02, 'rolling_30_day')
ON CONFLICT (metric_name) DO NOTHING;

-- ============================================================================
-- 9. CAMPAIGN ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  campaign_type TEXT,
  opens INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  sends INTEGER DEFAULT 0,
  open_rate NUMERIC,
  click_rate NUMERIC,
  conversion_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to campaign_analytics"
ON campaign_analytics FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Org members can view own campaign analytics"
ON campaign_analytics FOR SELECT
USING (
  organization_id IN (
    SELECT cu.organization_id FROM client_users cu WHERE cu.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_org ON campaign_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_type_created ON campaign_analytics(campaign_type, created_at DESC);

-- ============================================================================
-- 10. TAG RSS SOURCES WITH POLICY DOMAINS (using correct column name)
-- ============================================================================

-- Civil Rights sources
UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Criminal Justice', 'Voting Rights']
WHERE name ILIKE '%ACLU%' OR url ILIKE '%aclu%';

UPDATE rss_sources SET policy_domains = ARRAY['Civil Rights', 'Voting Rights', 'Criminal Justice']
WHERE name ILIKE '%Brennan Center%' OR url ILIKE '%brennancenter%';

-- Environmental sources
UPDATE rss_sources SET policy_domains = ARRAY['Environment']
WHERE name ILIKE '%Sierra Club%' OR url ILIKE '%sierraclub%';

UPDATE rss_sources SET policy_domains = ARRAY['Environment']
WHERE name ILIKE '%NRDC%' OR url ILIKE '%nrdc%';

-- Labor sources
UPDATE rss_sources SET policy_domains = ARRAY['Labor & Workers Rights', 'Economic Justice']
WHERE name ILIKE '%AFL-CIO%' OR url ILIKE '%aflcio%';

-- Immigration sources
UPDATE rss_sources SET policy_domains = ARRAY['Immigration', 'Civil Rights']
WHERE name ILIKE '%Immigration%' OR url ILIKE '%immigration%';

-- Healthcare sources
UPDATE rss_sources SET policy_domains = ARRAY['Healthcare']
WHERE name ILIKE '%Health%' OR url ILIKE '%health%' OR url ILIKE '%kff%';

-- General political news
UPDATE rss_sources SET policy_domains = ARRAY['Foreign Policy', 'Economic Justice', 'Civil Rights']
WHERE (name ILIKE '%Politico%' OR name ILIKE '%The Hill%' OR name ILIKE '%NPR%')
  AND (policy_domains IS NULL OR policy_domains = '{}');

-- Fallback based on category
UPDATE rss_sources SET policy_domains = 
  CASE 
    WHEN category = 'advocacy' THEN ARRAY['Civil Rights']
    WHEN category = 'government' THEN ARRAY['Voting Rights', 'Foreign Policy']
    WHEN category = 'news' THEN ARRAY['Civil Rights', 'Economic Justice']
    ELSE ARRAY[]::TEXT[]
  END
WHERE policy_domains IS NULL OR policy_domains = '{}';