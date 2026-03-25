-- Create storage bucket for extracted audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meta-ad-audio', 
  'meta-ad-audio', 
  true,
  52428800, -- 50MB limit for audio files
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meta-ad-audio');

-- RLS policy: Allow authenticated users to manage their uploaded audio
CREATE POLICY "Authenticated users can update their audio"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'meta-ad-audio');

-- RLS policy: Allow public read access for audio files
CREATE POLICY "Public read access for audio files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'meta-ad-audio');

-- Add columns to track audio extraction in meta_ad_videos table
ALTER TABLE public.meta_ad_videos
ADD COLUMN IF NOT EXISTS audio_extracted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS audio_filename text;