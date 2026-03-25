-- Add context and analysis tracking columns to meta_ad_transcripts
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN IF NOT EXISTS user_context_pre text,
ADD COLUMN IF NOT EXISTS user_context_post text,
ADD COLUMN IF NOT EXISTS analysis_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_analyzed_at timestamp with time zone;