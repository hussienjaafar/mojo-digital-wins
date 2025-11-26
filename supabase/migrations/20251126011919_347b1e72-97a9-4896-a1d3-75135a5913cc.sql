-- =============================================
-- POLITICAL INTELLIGENCE + CLIENT ENTITY SYSTEM
-- Complete Database Schema
-- =============================================

-- ===== 1. ENHANCED ACTBLUE TRANSACTIONS =====
-- Add all missing ActBlue webhook fields
ALTER TABLE actblue_transactions 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS addr1 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS employer TEXT,
ADD COLUMN IF NOT EXISTS occupation TEXT,
ADD COLUMN IF NOT EXISTS order_number TEXT,
ADD COLUMN IF NOT EXISTS contribution_form TEXT,
ADD COLUMN IF NOT EXISTS refcode2 TEXT,
ADD COLUMN IF NOT EXISTS refcode_custom TEXT,
ADD COLUMN IF NOT EXISTS ab_test_name TEXT,
ADD COLUMN IF NOT EXISTS ab_test_variation TEXT,
ADD COLUMN IF NOT EXISTS is_mobile BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_express BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS text_message_option TEXT,
ADD COLUMN IF NOT EXISTS lineitem_id BIGINT,
ADD COLUMN IF NOT EXISTS entity_id TEXT,
ADD COLUMN IF NOT EXISTS committee_name TEXT,
ADD COLUMN IF NOT EXISTS fec_id TEXT,
ADD COLUMN IF NOT EXISTS recurring_period TEXT,
ADD COLUMN IF NOT EXISTS recurring_duration INTEGER,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;

-- ===== 2. ORGANIZATION PROFILES =====
-- Scraped from client websites for AI context
CREATE TABLE IF NOT EXISTS organization_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE UNIQUE,
  website_url TEXT,
  mission_summary TEXT,
  focus_areas TEXT[] DEFAULT '{}',
  key_issues TEXT[] DEFAULT '{}',
  related_orgs TEXT[] DEFAULT '{}',
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 3. ENTITY WATCHLIST =====
-- Client-specific entities to track
CREATE TABLE IF NOT EXISTS entity_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('organization', 'person', 'topic', 'location', 'opposition', 'issue')),
  aliases TEXT[] DEFAULT '{}',
  alert_threshold INTEGER DEFAULT 5,
  sentiment_alert BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  relevance_score NUMERIC CHECK (relevance_score >= 0 AND relevance_score <= 100),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 4. ENTITY MENTIONS =====
-- Universal storage for all entity mentions across platforms
CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL,
  entity_type TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('article', 'bluesky', 'state_action', 'bill', 'executive_order')),
  source_id UUID NOT NULL,
  source_title TEXT,
  source_url TEXT,
  mentioned_at TIMESTAMPTZ NOT NULL,
  sentiment NUMERIC,
  context_snippet TEXT,
  platform_engagement JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_name_time ON entity_mentions(entity_name, mentioned_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_source ON entity_mentions(source_type, source_id);

-- ===== 5. ENTITY TRENDS =====
-- Aggregated trend data (calculated every 5 mins)
CREATE TABLE IF NOT EXISTS entity_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL UNIQUE,
  entity_type TEXT,
  mentions_1h INTEGER DEFAULT 0,
  mentions_6h INTEGER DEFAULT 0,
  mentions_24h INTEGER DEFAULT 0,
  mentions_7d INTEGER DEFAULT 0,
  velocity NUMERIC DEFAULT 0,
  is_trending BOOLEAN DEFAULT false,
  sentiment_avg NUMERIC,
  sentiment_change NUMERIC,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 6. CLIENT ENTITY ALERTS =====
-- Watchlist-triggered alerts for clients
CREATE TABLE IF NOT EXISTS client_entity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  watchlist_id UUID REFERENCES entity_watchlist(id) ON DELETE SET NULL,
  entity_name TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('spike', 'breaking', 'sentiment_shift', 'opposition_mention')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_actionable BOOLEAN DEFAULT false,
  actionable_score NUMERIC CHECK (actionable_score >= 0 AND actionable_score <= 100),
  current_mentions INTEGER,
  velocity NUMERIC,
  sample_sources JSONB DEFAULT '[]'::jsonb,
  suggested_action TEXT,
  is_read BOOLEAN DEFAULT false,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_alerts_org ON client_entity_alerts(organization_id, triggered_at DESC);

-- ===== 7. SUGGESTED ACTIONS =====
-- AI-generated SMS/action alert suggestions
CREATE TABLE IF NOT EXISTS suggested_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES client_entity_alerts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('sms_fundraising', 'action_alert', 'email_blast')),
  entity_name TEXT,
  topic_relevance NUMERIC CHECK (topic_relevance >= 0 AND topic_relevance <= 100),
  urgency_score NUMERIC CHECK (urgency_score >= 0 AND urgency_score <= 100),
  suggested_copy TEXT,
  value_prop TEXT,
  audience_segment TEXT,
  historical_performance JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'dismissed')),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 8. ATTRIBUTION TOUCHPOINTS =====
-- Track all donor interactions before donation
CREATE TABLE IF NOT EXISTS attribution_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  donor_email TEXT,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN ('meta_ad', 'sms', 'email', 'organic', 'other')),
  campaign_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  refcode TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_donor ON attribution_touchpoints(organization_id, donor_email, occurred_at DESC);

-- ===== 9. DONOR DEMOGRAPHICS =====
-- Demographics from ActBlue + voter file match
CREATE TABLE IF NOT EXISTS donor_demographics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  donor_email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  employer TEXT,
  occupation TEXT,
  -- ActBlue data
  first_donation_date TIMESTAMPTZ,
  last_donation_date TIMESTAMPTZ,
  total_donated NUMERIC DEFAULT 0,
  donation_count INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false,
  -- Voter file match (populated later)
  voter_file_matched BOOLEAN DEFAULT false,
  voter_file_match_date TIMESTAMPTZ,
  age INTEGER,
  gender TEXT,
  party_affiliation TEXT,
  voter_score NUMERIC,
  -- BigQuery sync
  bigquery_synced_at TIMESTAMPTZ,
  bigquery_id TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, donor_email)
);

CREATE INDEX IF NOT EXISTS idx_donor_demographics_org_email ON donor_demographics(organization_id, donor_email);

-- ===== 10. POLLING DATA =====
-- Aggregated polling from 538 + RCP
CREATE TABLE IF NOT EXISTS polling_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_type TEXT NOT NULL CHECK (poll_type IN ('senate', 'house', 'presidential', 'gubernatorial', 'issue', 'favorability')),
  race_id TEXT,
  state TEXT,
  district TEXT,
  candidate_name TEXT,
  issue_name TEXT,
  pollster TEXT,
  sample_size INTEGER,
  poll_date DATE,
  field_dates JSONB,
  result_value NUMERIC,
  margin_of_error NUMERIC,
  lead_margin NUMERIC,
  source TEXT NOT NULL CHECK (source IN ('fivethirtyeight', 'realclearpolitics', 'other')),
  source_url TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polling_race ON polling_data(poll_type, race_id, poll_date DESC);
CREATE INDEX IF NOT EXISTS idx_polling_state ON polling_data(state, poll_date DESC);

-- ===== 11. POLLING ALERTS =====
-- Significant poll changes
CREATE TABLE IF NOT EXISTS polling_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_type TEXT NOT NULL,
  race_id TEXT,
  state TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('lead_change', 'significant_move', 'new_poll')),
  previous_value NUMERIC,
  current_value NUMERIC,
  change_amount NUMERIC,
  description TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 12. WATCHLIST USAGE LOG =====
-- Track usage for future billing
CREATE TABLE IF NOT EXISTS watchlist_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('add_entity', 'remove_entity', 'alert_triggered', 'scrape_website', 'suggested_action_generated')),
  entity_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_org_date ON watchlist_usage_log(organization_id, created_at DESC);

-- ===== 13. ADMIN ACTIVITY ALERTS =====
-- Flag unusual client activity
CREATE TABLE IF NOT EXISTS admin_activity_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('excessive_topics', 'unusual_topic', 'high_usage', 'suspicious_pattern')),
  details TEXT,
  entity_name TEXT,
  relevance_score NUMERIC,
  usage_count INTEGER,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== 14. MULTI-TOUCH ATTRIBUTION MODEL =====
-- Store calculated attribution weights per transaction
CREATE TABLE IF NOT EXISTS transaction_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  organization_id UUID REFERENCES client_organizations(id) ON DELETE CASCADE,
  donor_email TEXT,
  -- Attribution model: 40% first, 20% middle, 40% last
  first_touch_channel TEXT,
  first_touch_campaign TEXT,
  first_touch_weight NUMERIC DEFAULT 0.4,
  last_touch_channel TEXT,
  last_touch_campaign TEXT,
  last_touch_weight NUMERIC DEFAULT 0.4,
  middle_touches JSONB DEFAULT '[]'::jsonb,
  middle_touches_weight NUMERIC DEFAULT 0.2,
  total_touchpoints INTEGER DEFAULT 0,
  attribution_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(transaction_id)
);

-- ===== RLS POLICIES =====

ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage org profiles" ON organization_profiles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own org profile" ON organization_profiles FOR SELECT USING (organization_id = get_user_organization_id());

ALTER TABLE entity_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage watchlists" ON entity_watchlist FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users manage own watchlist" ON entity_watchlist FOR ALL USING (organization_id = get_user_organization_id());

ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all mentions" ON entity_mentions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service insert mentions" ON entity_mentions FOR INSERT WITH CHECK (true);

ALTER TABLE entity_trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone view trends" ON entity_trends FOR SELECT USING (true);
CREATE POLICY "Service manage trends" ON entity_trends FOR ALL USING (true);

ALTER TABLE client_entity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all alerts" ON client_entity_alerts FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own alerts" ON client_entity_alerts FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users update own alerts" ON client_entity_alerts FOR UPDATE USING (organization_id = get_user_organization_id());

ALTER TABLE suggested_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all suggestions" ON suggested_actions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own suggestions" ON suggested_actions FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Users update own suggestions" ON suggested_actions FOR UPDATE USING (organization_id = get_user_organization_id());

ALTER TABLE attribution_touchpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage touchpoints" ON attribution_touchpoints FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own touchpoints" ON attribution_touchpoints FOR SELECT USING (organization_id = get_user_organization_id());

ALTER TABLE donor_demographics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage demographics" ON donor_demographics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own demographics" ON donor_demographics FOR SELECT USING (organization_id = get_user_organization_id());

ALTER TABLE polling_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone view polling" ON polling_data FOR SELECT USING (true);
CREATE POLICY "Service manage polling" ON polling_data FOR ALL USING (true);

ALTER TABLE polling_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view polling alerts" ON polling_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE watchlist_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view usage logs" ON watchlist_usage_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service log usage" ON watchlist_usage_log FOR INSERT WITH CHECK (true);

ALTER TABLE admin_activity_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activity alerts" ON admin_activity_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE transaction_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all attribution" ON transaction_attribution FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own attribution" ON transaction_attribution FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Service calculate attribution" ON transaction_attribution FOR ALL USING (true);