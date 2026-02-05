-- Add missing columns for video uploads
ALTER TABLE public.meta_ad_videos 
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS video_file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'api',
ADD COLUMN IF NOT EXISTS uploaded_by UUID;