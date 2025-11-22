-- Create AI analysis cache table for reducing API costs
CREATE TABLE IF NOT EXISTS public.ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT UNIQUE NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast cache lookups
CREATE INDEX idx_ai_cache_lookup ON public.ai_analysis_cache (content_hash, model, prompt_hash);

-- Index for cache cleanup (remove old unused entries)
CREATE INDEX idx_ai_cache_cleanup ON public.ai_analysis_cache (last_used_at, hit_count);

-- Enable RLS
ALTER TABLE public.ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can view cache" ON public.ai_analysis_cache
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Function to update cache hit count and last used time
CREATE OR REPLACE FUNCTION update_cache_hit()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hit_count := OLD.hit_count + 1;
  NEW.last_used_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;