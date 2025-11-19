-- Add missing columns to articles table that fetch-rss-feeds is trying to insert
-- These columns were referenced in the edge function but never added to the schema

-- Add threat_level column
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS threat_level TEXT DEFAULT 'low';

-- Add affected_organizations column
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS affected_organizations TEXT[] DEFAULT '{}';

-- Add index for threat_level filtering
CREATE INDEX IF NOT EXISTS idx_articles_threat_level ON public.articles(threat_level);

-- Add index for filtering by affected organizations
CREATE INDEX IF NOT EXISTS idx_articles_affected_orgs ON public.articles USING gin(affected_organizations);
