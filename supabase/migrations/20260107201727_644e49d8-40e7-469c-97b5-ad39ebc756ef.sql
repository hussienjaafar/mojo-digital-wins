-- Phase E: Update google_news_sources tier constraint to support tier1/tier2/tier3
ALTER TABLE google_news_sources DROP CONSTRAINT google_news_sources_tier_check;

ALTER TABLE google_news_sources ADD CONSTRAINT google_news_sources_tier_check 
CHECK (tier = ANY (ARRAY['national', 'state', 'local', 'international', 'specialized', 'tier1', 'tier2', 'tier3']::text[]));