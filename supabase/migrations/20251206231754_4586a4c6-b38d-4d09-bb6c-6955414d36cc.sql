-- Phase 1: Fix CTR normalization for existing data
-- Meta returns CTR as a percentage (e.g., 2.5 for 2.5%), but we want to store as decimal (0.025)
-- First normalize any CTR values that are already percentages (> 1 means it's a percentage)
UPDATE public.meta_creative_insights 
SET ctr = ctr / 100 
WHERE ctr > 1;

-- Phase 2: Add columns for video/image media tracking
ALTER TABLE public.meta_creative_insights 
ADD COLUMN IF NOT EXISTS meta_video_id TEXT,
ADD COLUMN IF NOT EXISTS meta_image_hash TEXT,
ADD COLUMN IF NOT EXISTS media_source_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS image_width INTEGER,
ADD COLUMN IF NOT EXISTS image_height INTEGER;

-- Phase 3: Add columns for improved predictive model tracking
ALTER TABLE public.meta_creative_insights
ADD COLUMN IF NOT EXISTS created_date DATE,
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS total_impressions BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spend NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_conversion_value NUMERIC(12,2) DEFAULT 0;

-- Add index for time-aware model queries
CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_first_seen 
ON public.meta_creative_insights(first_seen_at);

CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_created_date 
ON public.meta_creative_insights(created_date);

-- Add index for media type filtering
CREATE INDEX IF NOT EXISTS idx_meta_creative_insights_media_type 
ON public.meta_creative_insights(media_type);

-- Comment on columns for documentation
COMMENT ON COLUMN public.meta_creative_insights.ctr IS 'Click-through rate stored as decimal (0.025 = 2.5%)';
COMMENT ON COLUMN public.meta_creative_insights.meta_video_id IS 'Facebook video ID for direct API access';
COMMENT ON COLUMN public.meta_creative_insights.meta_image_hash IS 'Facebook image hash for tracking';
COMMENT ON COLUMN public.meta_creative_insights.media_source_url IS 'Direct downloadable URL for the media asset';
COMMENT ON COLUMN public.meta_creative_insights.first_seen_at IS 'When this creative was first ingested, for time-aware model training';