-- Add missing columns to articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS threat_level text DEFAULT 'low',
ADD COLUMN IF NOT EXISTS affected_organizations text[] DEFAULT '{}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_threat_level ON public.articles(threat_level);
CREATE INDEX IF NOT EXISTS idx_articles_affected_organizations ON public.articles USING GIN(affected_organizations);