-- Add missing analysis_model column to meta_ad_transcripts table

ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS analysis_model TEXT;