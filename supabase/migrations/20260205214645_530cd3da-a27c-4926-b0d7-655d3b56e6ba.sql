-- Update the meta_ad_videos status constraint to include 'CANCELLED'
-- Include all existing statuses found in the database

ALTER TABLE public.meta_ad_videos 
DROP CONSTRAINT IF EXISTS meta_ad_videos_status_check;

ALTER TABLE public.meta_ad_videos 
ADD CONSTRAINT meta_ad_videos_status_check 
CHECK (status IN (
  'PENDING', 'URL_FETCHED', 'DOWNLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 
  'ANALYZED', 'ERROR', 'FAILED', 'TRANSCRIPT_FAILED', 'COMPLETED', 
  'CANCELLED', 'error', 'URL_EXPIRED', 'URL_INACCESSIBLE'
));