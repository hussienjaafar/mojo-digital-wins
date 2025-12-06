-- PHASE 1: Normalize ALL existing CTR values to decimal format
-- meta_ad_metrics stores CTR as percentage (3.0 = 3%), needs to be decimal (0.03)
UPDATE public.meta_ad_metrics 
SET ctr = ctr / 100 
WHERE ctr > 1;

-- meta_creative_insights may also have old percentage values
UPDATE public.meta_creative_insights 
SET ctr = ctr / 100 
WHERE ctr > 1;

-- Create index for video transcription queries if not exists
CREATE INDEX IF NOT EXISTS idx_creative_insights_video_transcription 
ON public.meta_creative_insights (organization_id, creative_type, transcription_status) 
WHERE creative_type = 'video';

-- Extract video_id from existing video_url and populate meta_video_id
UPDATE public.meta_creative_insights
SET meta_video_id = REGEXP_REPLACE(video_url, '.*v=([0-9]+).*', '\1'),
    media_type = 'video'
WHERE video_url LIKE '%facebook.com/video.php%'
  AND meta_video_id IS NULL;