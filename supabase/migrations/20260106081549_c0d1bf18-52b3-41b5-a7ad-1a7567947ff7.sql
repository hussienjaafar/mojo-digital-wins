-- Phase 1: Expand source registry with prioritized Tier1/Tier2/Tier3 sources
-- First, update the tier check constraint to support new tier naming

-- Drop the old constraint
ALTER TABLE public.rss_sources DROP CONSTRAINT IF EXISTS rss_sources_tier_check;

-- Add new constraint supporting both legacy and new tier values
ALTER TABLE public.rss_sources ADD CONSTRAINT rss_sources_tier_check 
  CHECK (tier = ANY (ARRAY['national', 'state', 'local', 'international', 'specialized', 'tier1', 'tier2', 'tier3']));

-- ============================================================
-- TIER 1: Official/Government + High-Trust Sources
-- ============================================================

INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, fetch_frequency_minutes, is_active, source_type)
VALUES 
  ('White House Briefing Room', 'https://www.whitehouse.gov/briefing-room/feed/', 'government', 'tier1', ARRAY['executive', 'policy', 'press'], 'national', 10, 10, true, 'rss'),
  ('Federal Register', 'https://www.federalregister.gov/documents/recent.rss', 'government', 'tier1', ARRAY['regulatory', 'rulemaking', 'policy'], 'national', 30, 30, true, 'rss'),
  ('Congress.gov Bills', 'https://www.congress.gov/rss/bill/118/all.xml', 'government', 'tier1', ARRAY['legislation', 'congress'], 'national', 30, 30, true, 'rss'),
  ('DOJ Press Room', 'https://www.justice.gov/feeds/opa/justice-news.xml', 'government', 'tier1', ARRAY['justice', 'law'], 'national', 30, 30, true, 'rss'),
  ('DHS News', 'https://www.dhs.gov/news/rss.xml', 'government', 'tier1', ARRAY['immigration', 'security'], 'national', 30, 30, true, 'rss'),
  ('State Dept Press', 'https://www.state.gov/rss-feed/press-releases/feed/', 'government', 'tier1', ARRAY['foreign_policy', 'diplomacy'], 'national', 60, 60, true, 'rss')
ON CONFLICT (url) DO NOTHING;

-- ============================================================
-- TIER 2: National News + Statehouse Network
-- ============================================================

INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, fetch_frequency_minutes, is_active, source_type)
VALUES 
  ('NPR News', 'https://www.npr.org/rss/rss.php?id=1001', 'news', 'tier2', ARRAY['national', 'policy'], 'national', 15, 15, true, 'rss'),
  ('NYT Politics', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', 'news', 'tier2', ARRAY['national', 'politics'], 'national', 15, 15, true, 'rss'),
  ('BBC US/Canada', 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', 'news', 'tier2', ARRAY['international', 'us_policy'], 'international', 30, 30, true, 'rss'),
  ('Stateline', 'https://stateline.org/feed/', 'news', 'tier2', ARRAY['statehouse', 'policy'], 'national', 30, 30, true, 'rss')
ON CONFLICT (url) DO NOTHING;

-- ============================================================
-- TIER 3: Issue Specialists + Agency Sources
-- ============================================================

INSERT INTO public.rss_sources (name, url, category, tier, tags, geographic_scope, expected_cadence_mins, fetch_frequency_minutes, is_active, source_type)
VALUES 
  ('ACLU Press Releases', 'https://www.aclu.org/press-releases/feed', 'advocacy', 'tier3', ARRAY['civil_rights', 'advocacy'], 'national', 120, 120, true, 'rss'),
  ('Human Rights Watch', 'https://www.hrw.org/rss/news', 'advocacy', 'tier3', ARRAY['human_rights', 'international'], 'international', 120, 120, true, 'rss'),
  ('Migration Policy Institute', 'https://www.migrationpolicy.org/rss.xml', 'research', 'tier3', ARRAY['immigration', 'policy'], 'national', 120, 120, true, 'rss'),
  ('Inside Climate News', 'https://insideclimatenews.org/feed/', 'news', 'tier3', ARRAY['environment', 'policy'], 'national', 120, 120, true, 'rss'),
  ('HHS News', 'https://www.hhs.gov/about/news/rss.xml', 'government', 'tier3', ARRAY['healthcare', 'policy'], 'national', 120, 120, true, 'rss'),
  ('CDC Newsroom', 'https://tools.cdc.gov/api/v2/resources/media/403372.rss', 'government', 'tier3', ARRAY['public_health', 'policy'], 'national', 120, 120, true, 'rss'),
  ('Dept of Education', 'https://www.ed.gov/feed', 'government', 'tier3', ARRAY['education', 'policy'], 'national', 120, 120, true, 'rss'),
  ('Dept of Labor', 'https://www.dol.gov/rss/releases.xml', 'government', 'tier3', ARRAY['labor', 'economy'], 'national', 120, 120, true, 'rss'),
  ('Bureau of Labor Statistics', 'https://www.bls.gov/feed/bls_latest.rss', 'government', 'tier3', ARRAY['labor', 'economy', 'data'], 'national', 120, 120, true, 'rss')
ON CONFLICT (url) DO NOTHING;