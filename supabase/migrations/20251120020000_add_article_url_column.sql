-- Add url column to articles table to store individual article links
-- This is different from source_url which points to the RSS feed

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS url TEXT;

-- Add index for url lookups
CREATE INDEX IF NOT EXISTS idx_articles_url ON public.articles(url);

-- Add comment
COMMENT ON COLUMN public.articles.url IS 'Direct link to the article (different from source_url which is the RSS feed)';
