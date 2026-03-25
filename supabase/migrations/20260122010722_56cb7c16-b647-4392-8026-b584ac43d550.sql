-- Add link_clicks and link_ctr columns to metrics tables

-- Add to meta_ad_metrics_daily
ALTER TABLE public.meta_ad_metrics_daily 
ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_ctr NUMERIC(8,6);

-- Add to meta_creative_insights
ALTER TABLE public.meta_creative_insights 
ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_ctr NUMERIC(8,6);

-- Add to meta_creative_variations
ALTER TABLE public.meta_creative_variations 
ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_ctr NUMERIC(8,6);