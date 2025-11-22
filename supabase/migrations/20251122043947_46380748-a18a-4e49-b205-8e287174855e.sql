-- Add topic extraction tracking to articles table
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS topics_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS topics_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS extracted_topics JSONB DEFAULT '[]'::jsonb;

-- Index for fast lookup of unanalyzed articles
CREATE INDEX IF NOT EXISTS idx_articles_topics_extracted
ON public.articles(topics_extracted, published_date DESC)
WHERE topics_extracted = false;

COMMENT ON COLUMN public.articles.topics_extracted IS
'Whether AI topic extraction has been performed on this article';

COMMENT ON COLUMN public.articles.topics_extracted_at IS
'Timestamp when topics were last extracted';

COMMENT ON COLUMN public.articles.extracted_topics IS
'Array of topics extracted by AI: [{"topic": "name", "keywords": [...], "relevance": 0.9}]';