-- Phase 1: Expand Data Sources for Comprehensive Threat Monitoring
-- This migration adds Executive Orders, Government Announcements, and State Actions tracking

-- =============================================================================
-- 1. EXECUTIVE ORDERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.executive_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  abstract TEXT,
  full_text_url TEXT,
  pdf_url TEXT,
  html_url TEXT,
  signing_date DATE,
  publication_date DATE,
  president TEXT,
  executive_order_number INTEGER,
  document_type TEXT DEFAULT 'executive_order', -- executive_order, proclamation, memorandum
  agencies TEXT[],
  topics TEXT[],
  -- Relevance tracking
  relevance_score INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'low', -- critical, high, medium, low
  auto_tags TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  -- Metadata
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. STATE ACTIONS TABLE (Governors, AGs, State Legislatures)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.state_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL, -- TX, FL, MI, etc.
  state_name TEXT NOT NULL,
  action_type TEXT NOT NULL, -- executive_order, designation, legislation, lawsuit, announcement
  title TEXT NOT NULL,
  description TEXT,
  source_url TEXT,
  official_name TEXT, -- Governor Abbott, AG Paxton, etc.
  official_title TEXT, -- Governor, Attorney General, etc.
  action_date DATE,
  -- Relevance tracking
  relevance_score INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'low', -- critical, high, medium, low
  auto_tags TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  -- Affected entities
  affected_organizations TEXT[], -- CAIR, MPAC, etc.
  -- Metadata
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. GOVERNMENT ANNOUNCEMENTS TABLE (DOJ, DHS, FBI, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.government_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency TEXT NOT NULL, -- DOJ, DHS, FBI, CBP, ICE, etc.
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  source_url TEXT UNIQUE,
  publication_date TIMESTAMPTZ,
  announcement_type TEXT, -- press_release, statement, advisory, report
  -- Relevance tracking
  relevance_score INTEGER DEFAULT 0,
  threat_level TEXT DEFAULT 'low',
  auto_tags TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  -- Affected entities
  affected_organizations TEXT[],
  -- Metadata
  is_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 4. ADD PRIORITY/THREAT LEVELS TO EXISTING TABLES
-- =============================================================================

-- Add threat_level to articles
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS threat_level TEXT DEFAULT 'low',
ADD COLUMN IF NOT EXISTS affected_organizations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_breaking_news BOOLEAN DEFAULT false;

-- Add threat_level to bills
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS threat_level TEXT DEFAULT 'low',
ADD COLUMN IF NOT EXISTS affected_organizations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

-- Update notifications table with priority
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS threat_type TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT, -- article, bill, executive_order, state_action, government_announcement
ADD COLUMN IF NOT EXISTS source_id UUID;

-- =============================================================================
-- 5. CRITICAL ALERTS VIEW (Aggregates all high-priority items)
-- =============================================================================
CREATE OR REPLACE VIEW public.critical_alerts AS
SELECT
  'article' as source_type,
  id,
  title,
  description as summary,
  published_date as date,
  threat_level,
  affected_organizations,
  source_url as url
FROM public.articles
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  'bill' as source_type,
  id,
  title,
  COALESCE(ai_summary, short_title) as summary,
  introduced_date as date,
  threat_level,
  affected_organizations,
  bill_text_url as url
FROM public.bills
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  'executive_order' as source_type,
  id,
  title,
  COALESCE(ai_summary, abstract) as summary,
  signing_date as date,
  threat_level,
  '{}' as affected_organizations,
  html_url as url
FROM public.executive_orders
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  'state_action' as source_type,
  id,
  title,
  COALESCE(ai_summary, description) as summary,
  action_date as date,
  threat_level,
  affected_organizations,
  source_url as url
FROM public.state_actions
WHERE threat_level IN ('critical', 'high')
UNION ALL
SELECT
  'government_announcement' as source_type,
  id,
  title,
  COALESCE(ai_summary, description) as summary,
  publication_date::date as date,
  threat_level,
  affected_organizations,
  source_url as url
FROM public.government_announcements
WHERE threat_level IN ('critical', 'high')
ORDER BY date DESC;

-- =============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_exec_orders_signing_date ON public.executive_orders(signing_date DESC);
CREATE INDEX IF NOT EXISTS idx_exec_orders_threat ON public.executive_orders(threat_level);
CREATE INDEX IF NOT EXISTS idx_exec_orders_relevance ON public.executive_orders(relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_state_actions_state ON public.state_actions(state_code);
CREATE INDEX IF NOT EXISTS idx_state_actions_date ON public.state_actions(action_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_actions_threat ON public.state_actions(threat_level);
CREATE INDEX IF NOT EXISTS idx_state_actions_type ON public.state_actions(action_type);

CREATE INDEX IF NOT EXISTS idx_gov_announce_agency ON public.government_announcements(agency);
CREATE INDEX IF NOT EXISTS idx_gov_announce_date ON public.government_announcements(publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_gov_announce_threat ON public.government_announcements(threat_level);

CREATE INDEX IF NOT EXISTS idx_articles_threat ON public.articles(threat_level);
CREATE INDEX IF NOT EXISTS idx_bills_threat ON public.bills(threat_level);

-- =============================================================================
-- 7. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.executive_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_announcements ENABLE ROW LEVEL SECURITY;

-- Public read access for all
CREATE POLICY "Anyone can view executive orders"
  ON public.executive_orders FOR SELECT USING (true);

CREATE POLICY "Anyone can view state actions"
  ON public.state_actions FOR SELECT USING (true);

CREATE POLICY "Anyone can view government announcements"
  ON public.government_announcements FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admins can manage executive orders"
  ON public.executive_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage state actions"
  ON public.state_actions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage government announcements"
  ON public.government_announcements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- 8. ADD NEW RSS SOURCES FOR GOVERNMENT FEEDS
-- =============================================================================
INSERT INTO public.rss_sources (name, url, category, logo_url) VALUES
  -- Federal Government Sources
  ('White House', 'https://www.whitehouse.gov/feed/', 'government', null),
  ('DOJ Press Releases', 'https://www.justice.gov/feeds/opa/justice-news.xml', 'government', null),
  ('DHS News', 'https://www.dhs.gov/news-releases/rss.xml', 'government', null),
  ('FBI News', 'https://www.fbi.gov/feeds/fbi-news-stories/rss.xml', 'government', null),
  ('State Department', 'https://www.state.gov/rss-feed/press-releases/feed/', 'government', null),

  -- State Government - Key States
  ('Texas Governor', 'https://gov.texas.gov/news/rss', 'state_government', null),
  ('Florida Governor', 'https://www.flgov.com/feed/', 'state_government', null),
  ('Ohio Governor', 'https://governor.ohio.gov/media/news-and-media/rss', 'state_government', null),

  -- Civil Rights / Legal Sources
  ('ACLU', 'https://www.aclu.org/news/feed', 'civil_rights', null),
  ('Brennan Center', 'https://www.brennancenter.org/rss/all', 'civil_rights', null),
  ('EFF', 'https://www.eff.org/rss/updates.xml', 'civil_rights', null)

ON CONFLICT (url) DO NOTHING;

-- =============================================================================
-- 9. UPDATE TRIGGERS
-- =============================================================================
CREATE TRIGGER update_executive_orders_updated_at
  BEFORE UPDATE ON public.executive_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_state_actions_updated_at
  BEFORE UPDATE ON public.state_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gov_announcements_updated_at
  BEFORE UPDATE ON public.government_announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
