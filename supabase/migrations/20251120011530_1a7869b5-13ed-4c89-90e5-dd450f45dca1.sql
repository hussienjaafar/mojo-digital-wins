-- Add missing columns to daily_briefings table for smart-alerting function

ALTER TABLE public.daily_briefings
ADD COLUMN IF NOT EXISTS total_articles INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bills INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_executive_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_state_actions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS high_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS medium_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS top_critical_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS breaking_news_clusters JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS organization_mentions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS executive_summary TEXT,
ADD COLUMN IF NOT EXISTS key_takeaways TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON TABLE public.daily_briefings IS
'Daily intelligence briefings with comprehensive metrics and alerts';

COMMENT ON COLUMN public.daily_briefings.total_articles IS 'Total articles processed in last 24 hours';
COMMENT ON COLUMN public.daily_briefings.breaking_news_clusters IS 'Array of breaking news cluster IDs';
COMMENT ON COLUMN public.daily_briefings.organization_mentions IS 'Summary of organization mentions with threat counts';
COMMENT ON COLUMN public.daily_briefings.top_critical_items IS 'Array of top critical/high/medium priority items';