-- Enable pgvector extension for efficient embedding storage and search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to organization_profiles
ALTER TABLE public.organization_profiles
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS embedding_text text,
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

-- Add embedding columns to trend_events  
ALTER TABLE public.trend_events
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS embedding_text text,
ADD COLUMN IF NOT EXISTS embedding_generated_at timestamp with time zone;

-- Create index for fast similarity search on organization profiles
CREATE INDEX IF NOT EXISTS idx_org_profiles_embedding 
ON public.organization_profiles 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 50);

-- Create index for fast similarity search on trend events
CREATE INDEX IF NOT EXISTS idx_trend_events_embedding 
ON public.trend_events 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add semantic_similarity to org_trend_scores explanation
COMMENT ON TABLE public.org_trend_scores IS 'Organization-specific trend relevance scores with semantic matching';

-- Create helper function for cosine similarity (if needed in pure SQL)
CREATE OR REPLACE FUNCTION public.cosine_similarity(a vector, b vector)
RETURNS float8 AS $$
  SELECT 1 - (a <=> b);
$$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE;