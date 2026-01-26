-- Add missing columns to meta_ad_videos table for video sync pipeline

-- Add creative_id column for linking to Meta creatives
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS creative_id TEXT;

-- Add resolution_method to track how video_id was discovered
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS resolution_method TEXT;

-- Add url_fetched_at timestamp for when source URL was successfully fetched
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS url_fetched_at TIMESTAMPTZ;

-- Add video_source_expires_at for tracking URL expiration
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS video_source_expires_at TIMESTAMPTZ;

-- Drop old check constraint if exists
ALTER TABLE public.meta_ad_videos 
DROP CONSTRAINT IF EXISTS meta_ad_videos_status_check;

-- Add new status values (case-insensitive to allow existing lowercase values to work)
ALTER TABLE public.meta_ad_videos
ADD CONSTRAINT meta_ad_videos_status_check 
CHECK (LOWER(status) IN (
  'pending', 'url_fetched', 'url_expired', 'url_inaccessible',
  'downloading', 'downloaded', 'transcribing', 'transcribed', 
  'transcript_failed', 'completed', 'error'
));

-- Create index on creative_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_creative_id 
ON public.meta_ad_videos(creative_id);

-- Add comments for documentation
COMMENT ON COLUMN public.meta_ad_videos.creative_id IS 
  'Meta creative ID associated with this video';
COMMENT ON COLUMN public.meta_ad_videos.resolution_method IS 
  'How the video_id was resolved (meta_creative_insights, direct_api, etc)';
COMMENT ON COLUMN public.meta_ad_videos.url_fetched_at IS 
  'When the video source URL was successfully fetched from Meta API';
COMMENT ON COLUMN public.meta_ad_videos.video_source_expires_at IS 
  'When the video source URL expires (Meta URLs are temporary)';