-- Fix sentiment processing for existing articles
-- Sets processing_status to 'pending' for articles that haven't been analyzed yet

-- Update existing articles without sentiment analysis to 'pending'
UPDATE public.articles
SET processing_status = 'pending'
WHERE processing_status IS NULL
   OR (processing_status != 'completed' AND sentiment_label IS NULL);

-- Create index for faster processing_status queries
CREATE INDEX IF NOT EXISTS idx_articles_processing_status
ON public.articles(processing_status);

-- Create index for sentiment analysis queries
CREATE INDEX IF NOT EXISTS idx_articles_sentiment_label
ON public.articles(sentiment_label)
WHERE sentiment_label IS NOT NULL;

-- Ensure sentiment_confidence column exists (some migrations may have missed it)
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS sentiment_confidence NUMERIC;

-- Add unique constraint to sentiment_trends if not exists
-- This allows the upsert in analyze-articles to work properly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sentiment_trends_date_category_key'
  ) THEN
    ALTER TABLE public.sentiment_trends
    ADD CONSTRAINT sentiment_trends_date_category_key
    UNIQUE (date, category);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, that's fine - it will be created by earlier migration
    NULL;
END $$;
