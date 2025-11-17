-- Add sentiment analysis columns to articles
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
ADD COLUMN IF NOT EXISTS sentiment_confidence NUMERIC,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.articles(id),
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

-- Add index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_articles_hash ON public.articles(hash_signature);
CREATE INDEX IF NOT EXISTS idx_articles_duplicate ON public.articles(duplicate_of) WHERE is_duplicate = true;

-- Create table for sentiment trends
CREATE TABLE IF NOT EXISTS public.sentiment_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL,
  positive_count INTEGER DEFAULT 0,
  neutral_count INTEGER DEFAULT 0,
  negative_count INTEGER DEFAULT 0,
  avg_sentiment_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, category)
);

-- Enable RLS
ALTER TABLE public.sentiment_trends ENABLE ROW LEVEL SECURITY;

-- RLS policy for sentiment trends
CREATE POLICY "Anyone can view sentiment trends"
  ON public.sentiment_trends FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sentiment trends"
  ON public.sentiment_trends FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));