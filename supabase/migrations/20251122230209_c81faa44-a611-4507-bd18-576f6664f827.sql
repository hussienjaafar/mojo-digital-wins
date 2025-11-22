-- Create job failures tracking table for error recovery
CREATE TABLE IF NOT EXISTS public.job_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  context_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for querying pending retries
CREATE INDEX idx_job_failures_pending ON public.job_failures (created_at DESC) 
WHERE resolved_at IS NULL AND retry_count < max_retries;

-- Index for function name lookups
CREATE INDEX idx_job_failures_function ON public.job_failures (function_name, created_at DESC);

-- Create processing checkpoints table for incremental processing
CREATE TABLE IF NOT EXISTS public.processing_checkpoints (
  function_name TEXT PRIMARY KEY,
  last_processed_at TIMESTAMPTZ DEFAULT NOW(),
  last_processed_id UUID,
  records_processed INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add validation metadata to articles
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS validation_errors TEXT[];

-- Add validation metadata to bluesky_posts
ALTER TABLE public.bluesky_posts 
ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS validation_errors TEXT[];

-- Enable RLS on new tables
ALTER TABLE public.job_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_checkpoints ENABLE ROW LEVEL SECURITY;

-- Admin-only access to job_failures
CREATE POLICY "Admins can view job failures" ON public.job_failures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin-only access to processing checkpoints
CREATE POLICY "Admins can view checkpoints" ON public.processing_checkpoints
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );