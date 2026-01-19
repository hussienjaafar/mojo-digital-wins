-- ============================================================================
-- NEWS & TRENDS SYSTEM OVERHAUL - Database Schema Changes
-- Version 2.0 - Profile-First with Anti-Filter-Bubble Mechanisms
-- ============================================================================

-- ============================================================================
-- 1. RSS SOURCES - ADD POLICY DOMAINS
-- ============================================================================

ALTER TABLE rss_sources ADD COLUMN IF NOT EXISTS policy_domains TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_rss_sources_domains ON rss_sources USING GIN(policy_domains);

-- ============================================================================
-- 2. TREND EVENTS - ADD TAGGING FIELDS
-- ============================================================================

ALTER TABLE trend_events
ADD COLUMN IF NOT EXISTS policy_domains TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS geographies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS geo_level TEXT DEFAULT 'national',
ADD COLUMN IF NOT EXISTS politicians_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS organizations_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS legislation_mentioned TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evidence_by_domain JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_trend_events_domains ON trend_events USING GIN(policy_domains);
CREATE INDEX IF NOT EXISTS idx_trend_events_geos ON trend_events USING GIN(geographies);

-- ============================================================================
-- 3. ORG TOPIC AFFINITIES (LEARNING WITH SAFEGUARDS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_topic_affinities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  affinity_score DECIMAL(4,3) NOT NULL DEFAULT 0.5,  -- 0-1 scale
  times_used INTEGER DEFAULT 0,
  avg_performance DECIMAL(6,2) DEFAULT 0,
  best_performance DECIMAL(6,2) DEFAULT -100,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'learned_outcome',  -- 'learned_outcome', 'self_declared', 'admin_override'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_affinities_org ON org_topic_affinities(organization_id);
CREATE INDEX IF NOT EXISTS idx_affinities_score ON org_topic_affinities(organization_id, affinity_score DESC);
CREATE INDEX IF NOT EXISTS idx_affinities_stale ON org_topic_affinities(last_used_at, affinity_score)
  WHERE source = 'learned_outcome';

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

CREATE INDEX IF NOT EXISTS idx_org_trend_cache_lookup
  ON org_trend_relevance_cache(organization_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_trend_cache_new_opp
  ON org_trend_relevance_cache(organization_id) WHERE is_new_opportunity = true;

-- ============================================================================
-- 5. CAMPAIGN TOPIC EXTRACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_topic_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  campaign_type TEXT NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  policy_domains TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  entities TEXT[] DEFAULT '{}',
  emotional_appeals TEXT[] DEFAULT '{}',
  raw_content TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_topics_org ON campaign_topic_extractions(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaign_topics_campaign ON campaign_topic_extractions(campaign_id);

-- ============================================================================
-- 6. TREND-CAMPAIGN CORRELATIONS
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
  campaign_performance JSONB,
  performance_vs_baseline DECIMAL(6,2),
  outcome_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlations_trend ON trend_campaign_correlations(trend_event_id);
CREATE INDEX IF NOT EXISTS idx_correlations_org ON trend_campaign_correlations(organization_id);
CREATE INDEX IF NOT EXISTS idx_correlations_outcome ON trend_campaign_correlations(outcome_label);

-- ============================================================================
-- 7. TREND FILTER LOG (DEBUGGING FILTER BUBBLES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trend_filter_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  trend_event_id UUID REFERENCES trend_events(id) ON DELETE CASCADE,
  relevance_score INTEGER,
  filter_reason TEXT,
  matched_domains TEXT[] DEFAULT '{}',
  was_new_opportunity BOOLEAN DEFAULT false,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filter_log_org ON trend_filter_log(organization_id, logged_at DESC);

-- Automatically clean up old logs (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_filter_logs() RETURNS void AS $$
BEGIN
  DELETE FROM trend_filter_log WHERE logged_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. POLITICAL ENTITIES KNOWLEDGE BASE
-- ============================================================================

CREATE TABLE IF NOT EXISTS political_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL,  -- 'politician', 'organization', 'legislation', 'agency'
  aliases TEXT[] DEFAULT '{}',
  party TEXT,
  state TEXT,
  office TEXT,
  policy_domains TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_political_entities_type ON political_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_political_entities_aliases ON political_entities USING GIN(aliases);

-- ============================================================================
-- 9. POLICY DOMAIN KEYWORDS REFERENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS policy_domain_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  keyword TEXT NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, keyword)
);

CREATE INDEX IF NOT EXISTS idx_domain_keywords ON policy_domain_keywords(domain);

-- ============================================================================
-- 10. RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE org_topic_affinities ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_trend_relevance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_topic_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_campaign_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_filter_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE political_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_domain_keywords ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access org_topic_affinities" ON org_topic_affinities
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access org_trend_relevance_cache" ON org_trend_relevance_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access campaign_topic_extractions" ON campaign_topic_extractions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access trend_campaign_correlations" ON trend_campaign_correlations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access trend_filter_log" ON trend_filter_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access political_entities" ON political_entities
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access policy_domain_keywords" ON policy_domain_keywords
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can read their own org data
CREATE POLICY "Users can view own org affinities" ON org_topic_affinities
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own org trend cache" ON org_trend_relevance_cache
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own org campaign topics" ON campaign_topic_extractions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own org correlations" ON trend_campaign_correlations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM client_users WHERE user_id = auth.uid()
    )
  );

-- Public read for reference tables
CREATE POLICY "Public read political_entities" ON political_entities
  FOR SELECT USING (true);

CREATE POLICY "Public read policy_domain_keywords" ON policy_domain_keywords
  FOR SELECT USING (true);

-- ============================================================================
-- 11. ADD policy_domains TO org_profiles IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_profiles' AND column_name = 'policy_domains'
  ) THEN
    ALTER TABLE org_profiles ADD COLUMN policy_domains TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- 12. JOB SCHEDULER ENTRIES FOR NEW FUNCTIONS
-- ============================================================================

-- Add scheduled jobs for the new functions
INSERT INTO scheduled_jobs (job_name, function_name, schedule_cron, is_enabled, description)
VALUES
  ('decay_stale_affinities', 'decay-stale-affinities', '0 3 * * 0', true, 'Weekly decay of unused topic affinities'),
  ('refresh_relevance_cache', 'refresh-relevance-cache', '0 * * * *', true, 'Hourly refresh of org trend relevance cache'),
  ('cleanup_filter_logs', 'cleanup-filter-logs', '0 4 * * *', true, 'Daily cleanup of filter logs older than 30 days')
ON CONFLICT (job_name) DO UPDATE SET
  function_name = EXCLUDED.function_name,
  schedule_cron = EXCLUDED.schedule_cron,
  description = EXCLUDED.description;
