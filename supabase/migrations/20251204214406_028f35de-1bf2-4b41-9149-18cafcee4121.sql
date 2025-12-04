-- Add entity type and hashtag tracking to trend_clusters
ALTER TABLE public.trend_clusters 
ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'topic',
ADD COLUMN IF NOT EXISTS specificity_score numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_hashtag boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_breaking boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS related_topics text[] DEFAULT '{}';

-- Create index for entity type queries
CREATE INDEX IF NOT EXISTS idx_trend_clusters_entity_type ON public.trend_clusters(entity_type);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_specificity ON public.trend_clusters(specificity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trend_clusters_is_breaking ON public.trend_clusters(is_breaking) WHERE is_breaking = true;

-- Add hashtags column to google_news_articles for extraction
ALTER TABLE public.google_news_articles 
ADD COLUMN IF NOT EXISTS extracted_hashtags text[] DEFAULT '{}';

-- Add hashtags column to articles (RSS) for extraction  
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS extracted_hashtags text[] DEFAULT '{}';